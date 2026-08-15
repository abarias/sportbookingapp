import { describe, expect, it } from "vitest";

import { registerSchema, resendVerificationEmailSchema, verifyEmailSchema } from "./schemas";

const validRegistration = {
  fullName: "Juan Dela Cruz",
  email: "juan@example.com",
  phone: "09171234567",
  password: "StrongPass123",
  confirmPassword: "StrongPass123",
  companyWebsite: ""
};

describe("auth schemas", () => {
  it("accepts a valid Philippine customer registration", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "DifferentPass123"
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects passwords shorter than 10 characters", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      password: "Short123",
      confirmPassword: "Short123"
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects passwords without letters and numbers", () => {
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        password: "NoNumbersHere",
        confirmPassword: "NoNumbersHere"
      }).success
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        password: "1234567890",
        confirmPassword: "1234567890"
      }).success
    ).toBe(false);
  });

  it("rejects common weak passwords", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      password: "password123",
      confirmPassword: "password123"
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects passwords based on email or name", () => {
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        password: "juanSecure123",
        confirmPassword: "juanSecure123"
      }).success
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        password: "DelaSecure123",
        confirmPassword: "DelaSecure123"
      }).success
    ).toBe(false);
  });

  it("rejects invalid Philippine mobile numbers", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      phone: "12345"
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects filled honeypot fields", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      companyWebsite: "https://spam.example"
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts six-digit email verification codes", () => {
    expect(verifyEmailSchema.safeParse({ email: "juan@example.com", code: "123456" }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ email: "juan@example.com", code: "12345" }).success).toBe(false);
  });

  it("accepts valid resend verification email requests", () => {
    expect(resendVerificationEmailSchema.safeParse({ email: "juan@example.com" }).success).toBe(true);
    expect(resendVerificationEmailSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
