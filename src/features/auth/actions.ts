"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getAuthConfig, minutesToMilliseconds } from "@/lib/config/auth";
import { isLocalMockOtpAllowed } from "@/lib/config/env";
import { sendVerificationEmail } from "@/lib/notifications/email";
import { getRequestIpHash } from "@/lib/security/request";
import { registerSchema, resendVerificationEmailSchema, verifyEmailSchema } from "@/features/auth/schemas";

export type RegisterActionState = {
  message?: string;
  pendingEmail?: string;
  devVerificationCode?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "password" | "confirmPassword", string>>;
};

export type VerifyEmailActionState = {
  message?: string;
  success?: string;
  fieldErrors?: Partial<Record<"code", string>>;
};

export type ResendVerificationEmailActionState = {
  message?: string;
  pendingEmail?: string;
  devVerificationCode?: string;
  fieldErrors?: Partial<Record<"email", string>>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function recordRegistrationAttempt(params: {
  email?: string;
  ipHash?: string;
  outcome: string;
  userId?: string;
}) {
  await prisma.registrationAttempt.create({
    data: {
      email: params.email,
      ipHash: params.ipHash,
      outcome: params.outcome,
      userId: params.userId
    }
  });
}

async function isRegistrationRateLimited(email: string, ipHash: string) {
  const authConfig = getAuthConfig();
  const since = new Date(Date.now() - minutesToMilliseconds(authConfig.registrationWindowMinutes));
  const attempts = await prisma.registrationAttempt.count({
    where: {
      createdAt: { gte: since },
      OR: [{ email }, { ipHash }]
    }
  });

  return attempts >= authConfig.maxRegistrationAttempts;
}

async function isResendVerificationRateLimited(email: string, ipHash: string) {
  const authConfig = getAuthConfig();
  const since = new Date(Date.now() - minutesToMilliseconds(authConfig.resendVerificationWindowMinutes));
  const attempts = await prisma.registrationAttempt.count({
    where: {
      createdAt: { gte: since },
      outcome: {
        in: [
          "VERIFICATION_RESENT",
          "VERIFICATION_REQUEST_GENERIC",
          "VERIFICATION_ALREADY_COMPLETE",
          "VERIFICATION_RESEND_RATE_LIMITED",
          "UNIQUE_EMAIL_RACE_VERIFICATION_SENT"
        ]
      },
      OR: [{ email }, { ipHash }]
    }
  });

  return attempts >= authConfig.maxResendVerificationAttempts;
}

async function createAndSendVerificationCode(params: {
  userId: string;
  email: string;
  fullName: string;
  ipHash: string;
  outcome: string;
}) {
  const authConfig = getAuthConfig();
  const verificationCode = createVerificationCode();
  const expiresAt = new Date(Date.now() + minutesToMilliseconds(authConfig.emailVerificationExpiryMinutes));

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: {
        userId: params.userId,
        verifiedAt: null
      },
      data: {
        verifiedAt: new Date()
      }
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: params.userId,
        email: params.email,
        tokenHash: await bcrypt.hash(verificationCode, 10),
        expiresAt
      }
    });

    await tx.registrationAttempt.create({
      data: {
        email: params.email,
        ipHash: params.ipHash,
        outcome: params.outcome,
        userId: params.userId
      }
    });
  });

  await sendVerificationEmail({
    to: params.email,
    fullName: params.fullName,
    code: verificationCode,
    expiresInMinutes: authConfig.emailVerificationExpiryMinutes
  });

  return verificationCode;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function registerUserAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const rawEmail = String(formData.get("email") ?? "");
  const email = normalizeEmail(rawEmail);
  const ipHash = await getRequestIpHash();

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: rawEmail,
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    companyWebsite: formData.get("companyWebsite")
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    await recordRegistrationAttempt({
      email: email || undefined,
      ipHash,
      outcome: flattened.companyWebsite ? "HONEYPOT" : "VALIDATION_FAILED"
    });

    return {
      message: flattened.companyWebsite ? "Registration received. Check your email for the next step." : "Please correct the form and try again.",
      fieldErrors: {
        fullName: flattened.fullName?.[0],
        email: flattened.email?.[0],
        phone: flattened.phone?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0]
      }
    };
  }

  if (await isRegistrationRateLimited(email, ipHash)) {
    await recordRegistrationAttempt({ email, ipHash, outcome: "RATE_LIMITED" });

    return {
      message: "Too many signup attempts. Please wait a few minutes before trying again."
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, role: true }
  });

  if (existingUser?.emailVerifiedAt) {
    await recordRegistrationAttempt({ email, ipHash, outcome: "EXISTING_VERIFIED", userId: existingUser.id });

    return {
      message: "If this email needs verification, we sent the next step to that inbox."
    };
  }

  let user: {
    id: string;
    fullName: string;
  };

  try {
    user = await prisma.$transaction(async (tx) => {
      const savedUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: parsed.data.fullName,
              phone: parsed.data.phone,
              passwordHash: await hashPassword(parsed.data.password)
            }
          })
        : await tx.user.create({
            data: {
              fullName: parsed.data.fullName,
              email,
              phone: parsed.data.phone,
              passwordHash: await hashPassword(parsed.data.password),
              role: "CUSTOMER"
            }
          });

      await tx.registrationAttempt.create({
        data: {
          email,
          ipHash,
          outcome: existingUser ? "UPDATED_UNVERIFIED" : "CREATED_UNVERIFIED",
          userId: savedUser.id
        }
      });

      return savedUser;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const racedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, emailVerifiedAt: true, role: true }
    });

    if (racedUser && !racedUser.emailVerifiedAt && racedUser.role === "CUSTOMER") {
      const verificationCode = await createAndSendVerificationCode({
        userId: racedUser.id,
        email,
        fullName: racedUser.fullName,
        ipHash,
        outcome: "UNIQUE_EMAIL_RACE_VERIFICATION_SENT"
      });

      return {
        message: "If this email needs verification, we sent the next step to that inbox.",
        pendingEmail: email,
        devVerificationCode: isLocalMockOtpAllowed() ? verificationCode : undefined
      };
    }

    await recordRegistrationAttempt({ email, ipHash, outcome: "UNIQUE_EMAIL_RACE" });

    return {
      message: "If this email needs verification, we sent the next step to that inbox."
    };
  }

  const verificationCode = await createAndSendVerificationCode({
    userId: user.id,
    email,
    fullName: user.fullName,
    ipHash,
    outcome: "VERIFICATION_SENT"
  });

  return {
    message: "Account created. Check your email for the verification code.",
    pendingEmail: email,
    devVerificationCode: isLocalMockOtpAllowed() ? verificationCode : undefined
  };
}

export async function verifyRegistrationEmailAction(
  _prevState: VerifyEmailActionState,
  formData: FormData
): Promise<VerifyEmailActionState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code")
  });

  if (!parsed.success) {
    return {
      message: "Please enter the verification code.",
      fieldErrors: {
        code: parsed.error.flatten().fieldErrors.code?.[0]
      }
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const authConfig = getAuthConfig();
  const token = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      verifiedAt: null,
      attempts: { lt: authConfig.maxEmailVerificationAttempts },
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!token) {
    return {
      message: "The verification code has expired or has too many failed attempts. Please register again to receive a new code."
    };
  }

  const isValid = await bcrypt.compare(parsed.data.code, token.tokenHash);

  if (!isValid) {
    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } }
    });

    return {
      message: "Incorrect verification code.",
      fieldErrors: {
        code: "Check the code and try again."
      }
    };
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: { verifiedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  redirect("/login?registered=1");
}

export async function resendVerificationEmailAction(
  _prevState: ResendVerificationEmailActionState,
  formData: FormData
): Promise<ResendVerificationEmailActionState> {
  const rawEmail = String(formData.get("email") ?? "");
  const email = normalizeEmail(rawEmail);
  const ipHash = await getRequestIpHash();
  const parsed = resendVerificationEmailSchema.safeParse({ email: rawEmail });

  if (!parsed.success) {
    return {
      message: "Enter the email address you used to register.",
      fieldErrors: {
        email: parsed.error.flatten().fieldErrors.email?.[0]
      }
    };
  }

  if (await isResendVerificationRateLimited(email, ipHash)) {
    await recordRegistrationAttempt({ email, ipHash, outcome: "VERIFICATION_RESEND_RATE_LIMITED" });

    return {
      message: "Too many verification requests. Please wait a few minutes before trying again."
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      emailVerifiedAt: true,
      role: true
    }
  });

  if (!user || user.emailVerifiedAt || user.role !== "CUSTOMER") {
    await recordRegistrationAttempt({
      email,
      ipHash,
      outcome: user?.emailVerifiedAt ? "VERIFICATION_ALREADY_COMPLETE" : "VERIFICATION_REQUEST_GENERIC",
      userId: user?.id
    });

    return {
      message: "If this email needs verification, we sent the next step to that inbox.",
      pendingEmail: email
    };
  }

  const verificationCode = await createAndSendVerificationCode({
    userId: user.id,
    email,
    fullName: user.fullName,
    ipHash,
    outcome: "VERIFICATION_RESENT"
  });

  return {
    message: "If this email needs verification, we sent the next step to that inbox.",
    pendingEmail: email,
    devVerificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode
  };
}
