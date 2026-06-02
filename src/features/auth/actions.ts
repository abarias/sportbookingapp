"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema, verifyOtpSchema } from "@/features/auth/schemas";

export type RegisterActionState = {
  message?: string;
  pendingUserId?: string;
  devOtp?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "password" | "confirmPassword", string>>;
};

export type VerifyOtpActionState = {
  message?: string;
  success?: string;
  fieldErrors?: Partial<Record<"code", string>>;
};

export async function registerUserAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      message: "Please correct the form and try again.",
      fieldErrors: {
        fullName: flattened.fullName?.[0],
        email: flattened.email?.[0],
        phone: flattened.phone?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0]
      }
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true }
  });

  if (existingUser) {
    return {
      message: "An account with that email already exists.",
      fieldErrors: {
        email: "Email is already in use."
      }
    };
  }

  const devOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const user = await prisma.user.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      passwordHash: await hashPassword(parsed.data.password),
      role: "CUSTOMER"
    }
  });

  await prisma.otpRequest.create({
    data: {
      userId: user.id,
      phone: parsed.data.phone,
      codeHash: await bcrypt.hash(devOtp, 10),
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }
  });

  return {
    message: "Account created. Verify your mobile number to finish registration.",
    pendingUserId: user.id,
    devOtp
  };
}

export async function verifyRegistrationOtpAction(
  _prevState: VerifyOtpActionState,
  formData: FormData
): Promise<VerifyOtpActionState> {
  const parsed = verifyOtpSchema.safeParse({
    userId: formData.get("userId"),
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

  const otp = await prisma.otpRequest.findFirst({
    where: {
      userId: parsed.data.userId,
      verifiedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!otp) {
    return {
      message: "The verification code has expired. Please register again or contact staff."
    };
  }

  const isValid = await bcrypt.compare(parsed.data.code, otp.codeHash);

  if (!isValid) {
    await prisma.otpRequest.update({
      where: { id: otp.id },
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
    prisma.otpRequest.update({
      where: { id: otp.id },
      data: { verifiedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: parsed.data.userId },
      data: { phoneVerifiedAt: new Date() }
    })
  ]);

  redirect("/login?registered=1");
}
