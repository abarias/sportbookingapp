import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      create: vi.fn(),
      update: vi.fn()
    },
    emailVerificationToken: {
      create: vi.fn(),
      updateMany: vi.fn()
    },
    registrationAttempt: {
      create: vi.fn()
    }
  };
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    emailVerificationToken: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    registrationAttempt: {
      count: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  };

  return {
    getRequestIpHash: vi.fn(),
    prisma,
    redirect: vi.fn(),
    sendVerificationEmail: vi.fn(),
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma
}));

vi.mock("@/lib/notifications/email", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail
}));

vi.mock("@/lib/security/request", () => ({
  getRequestIpHash: mocks.getRequestIpHash
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

import { registerUserAction, resendVerificationEmailAction, verifyRegistrationEmailAction } from "./actions";

function formData(values: Record<string, string>) {
  const form = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    form.set(key, value);
  });

  return form;
}

function registrationForm(overrides: Record<string, string> = {}) {
  return formData({
    fullName: "Juan Dela Cruz",
    email: "Juan@Example.com",
    phone: "09171234567",
    password: "StrongPass123",
    confirmPassword: "StrongPass123",
    companyWebsite: "",
    ...overrides
  });
}

function uniqueEmailError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "test",
    code: "P2002",
    meta: { target: ["email"] }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRequestIpHash.mockResolvedValue("ip_hash");
  mocks.prisma.registrationAttempt.count.mockResolvedValue(0);
  mocks.prisma.registrationAttempt.create.mockResolvedValue({});
  mocks.prisma.user.findUnique.mockResolvedValue(null);
  mocks.prisma.user.update.mockResolvedValue({});
  mocks.prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
  mocks.prisma.emailVerificationToken.update.mockResolvedValue({});
  mocks.tx.user.create.mockResolvedValue({ id: "user_1", fullName: "Juan Dela Cruz" });
  mocks.tx.user.update.mockResolvedValue({ id: "user_1", fullName: "Juan Dela Cruz" });
  mocks.tx.emailVerificationToken.create.mockResolvedValue({});
  mocks.tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.registrationAttempt.create.mockResolvedValue({});
  mocks.prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mocks.tx) => unknown)(mocks.tx);
    }

    return Promise.all(arg as Promise<unknown>[]);
  });
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  mocks.sendVerificationEmail.mockResolvedValue({ delivered: true });
});

describe("registerUserAction", () => {
  it("creates an unverified customer and sends a verification code", async () => {
    const result = await registerUserAction({}, registrationForm());

    expect(result.pendingEmail).toBe("juan@example.com");
    expect(result.devVerificationCode).toMatch(/^\d{6}$/);
    expect(mocks.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "juan@example.com",
          phone: "09171234567",
          role: "CUSTOMER"
        })
      })
    );
    expect(mocks.tx.emailVerificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "juan@example.com",
          userId: "user_1"
        })
      })
    );
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "juan@example.com"
      })
    );
  });

  it("records honeypot submissions without creating a user", async () => {
    const result = await registerUserAction({}, registrationForm({ companyWebsite: "https://bot.example" }));

    expect(result.message).toBe("Registration received. Check your email for the next step.");
    expect(mocks.prisma.registrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "HONEYPOT" })
      })
    );
    expect(mocks.tx.user.create).not.toHaveBeenCalled();
  });

  it("blocks registration after too many attempts", async () => {
    mocks.prisma.registrationAttempt.count.mockResolvedValue(5);

    const result = await registerUserAction({}, registrationForm());

    expect(result.message).toBe("Too many signup attempts. Please wait a few minutes before trying again.");
    expect(mocks.prisma.registrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "RATE_LIMITED" })
      })
    );
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not reveal already verified accounts", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      emailVerifiedAt: new Date(),
      id: "existing_user",
      role: "CUSTOMER"
    });

    const result = await registerUserAction({}, registrationForm());

    expect(result.message).toBe("If this email needs verification, we sent the next step to that inbox.");
    expect(mocks.prisma.registrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: "EXISTING_VERIFIED",
          userId: "existing_user"
        })
      })
    );
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("recovers from unique email race conditions for unverified customers", async () => {
    mocks.prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        emailVerifiedAt: null,
        fullName: "Juan Dela Cruz",
        id: "raced_user",
        role: "CUSTOMER"
      });
    mocks.prisma.$transaction
      .mockRejectedValueOnce(uniqueEmailError())
      .mockImplementationOnce(async (arg: unknown) => (arg as (tx: typeof mocks.tx) => unknown)(mocks.tx));

    const result = await registerUserAction({}, registrationForm());

    expect(result.pendingEmail).toBe("juan@example.com");
    expect(mocks.tx.emailVerificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "juan@example.com",
          userId: "raced_user"
        })
      })
    );
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "juan@example.com"
      })
    );
  });
});

describe("verifyRegistrationEmailAction", () => {
  it("marks the token and user verified when the code is valid", async () => {
    const tokenHash = await bcrypt.hash("123456", 4);
    mocks.prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: "token_1",
      tokenHash,
      userId: "user_1"
    });

    await expect(
      verifyRegistrationEmailAction(
        {},
        formData({
          email: "Juan@Example.com",
          code: "123456"
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/login?registered=1");

    expect(mocks.prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: "token_1" },
      data: { verifiedAt: expect.any(Date) }
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailVerifiedAt: expect.any(Date) }
    });
  });

  it("increments attempts when the code is invalid", async () => {
    const tokenHash = await bcrypt.hash("654321", 4);
    mocks.prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: "token_1",
      tokenHash,
      userId: "user_1"
    });

    const result = await verifyRegistrationEmailAction(
      {},
      formData({
        email: "juan@example.com",
        code: "123456"
      })
    );

    expect(result.fieldErrors?.code).toBe("Check the code and try again.");
    expect(mocks.prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: "token_1" },
      data: { attempts: { increment: 1 } }
    });
  });

  it("returns a safe error for expired or exhausted tokens", async () => {
    const result = await verifyRegistrationEmailAction(
      {},
      formData({
        email: "juan@example.com",
        code: "123456"
      })
    );

    expect(result.message).toBe("The verification code has expired or has too many failed attempts. Please register again to receive a new code.");
  });
});

describe("resendVerificationEmailAction", () => {
  it("resends verification for an unverified customer", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      emailVerifiedAt: null,
      fullName: "Juan Dela Cruz",
      id: "user_1",
      role: "CUSTOMER"
    });

    const result = await resendVerificationEmailAction(
      {},
      formData({
        email: "Juan@Example.com"
      })
    );

    expect(result.pendingEmail).toBe("juan@example.com");
    expect(result.devVerificationCode).toMatch(/^\d{6}$/);
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "juan@example.com"
      })
    );
  });

  it("rate-limits verification resend requests", async () => {
    mocks.prisma.registrationAttempt.count.mockResolvedValue(3);

    const result = await resendVerificationEmailAction(
      {},
      formData({
        email: "juan@example.com"
      })
    );

    expect(result.message).toBe("Too many verification requests. Please wait a few minutes before trying again.");
    expect(mocks.prisma.registrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "VERIFICATION_RESEND_RATE_LIMITED" })
      })
    );
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
