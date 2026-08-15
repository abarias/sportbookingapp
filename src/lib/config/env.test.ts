import { describe, expect, it } from "vitest";

import { getPaymentMode, isStrictProductionEnvironment, validateServerEnvironment } from "./env";

type TestEnv = Record<string, string | undefined>;

function buildValidProductionEnv(overrides: TestEnv = {}): TestEnv {
  return {
    AUTH_STRICT_ENV_VALIDATION: "true",
    DATABASE_URL: "postgresql://user:password@db.example.com:5432/app",
    NEXTAUTH_URL: "https://sportsapp.example.com",
    NEXTAUTH_SECRET: "a-production-secret-with-at-least-32-chars",
    RESEND_API_KEY: "re_123456789",
    EMAIL_FROM: "Sport Booking <bookings@example.com>",
    PAYMENT_MODE: "manual",
    PAYMENT_HOLD_MINUTES: "15",
    ...overrides
  };
}

describe("server environment validation", () => {
  it("allows development defaults while still validating numeric overrides", () => {
    const result = validateServerEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sportbookingapp",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "dev-only-secret",
      PAYMENT_HOLD_MINUTES: "0"
    });

    expect(result.isStrictProduction).toBe(false);
    expect(result.errors).toEqual(["PAYMENT_HOLD_MINUTES must be a positive integer when set."]);
  });

  it("treats Vercel production and explicit strict validation as production mode", () => {
    expect(isStrictProductionEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isStrictProductionEnvironment({ AUTH_STRICT_ENV_VALIDATION: "true" })).toBe(true);
    expect(isStrictProductionEnvironment({ VERCEL_ENV: "preview" })).toBe(false);
  });

  it("defaults to mock payments in development and manual payments in strict production", () => {
    expect(getPaymentMode({})).toBe("mock");
    expect(getPaymentMode({ VERCEL_ENV: "production" })).toBe("manual");
    expect(getPaymentMode({ PAYMENT_MODE: "gateway" })).toBe("gateway");
  });

  it("accepts a valid production manual-payment environment", () => {
    const result = validateServerEnvironment(buildValidProductionEnv());

    expect(result).toEqual({ isStrictProduction: true, errors: [] });
  });

  it("rejects unsafe production placeholders and local endpoints", () => {
    const result = validateServerEnvironment(
      buildValidProductionEnv({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app",
        DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/app",
        NEXTAUTH_URL: "http://localhost:3000",
        NEXTAUTH_SECRET: "dev-only-secret",
        RESEND_API_KEY: "",
        EMAIL_FROM: "",
        PAYMENT_MODE: "invalid"
      })
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "DATABASE_URL must not point to localhost in production.",
        "DIRECT_URL must not point to localhost in production.",
        "NEXTAUTH_URL must be an HTTPS URL in production.",
        "NEXTAUTH_URL must not point to localhost in production.",
        "NEXTAUTH_SECRET must be a strong non-placeholder value with at least 32 characters.",
        "RESEND_API_KEY must be configured for production email verification.",
        "EMAIL_FROM must be configured with a verified sender address.",
        "PAYMENT_MODE must be one of: manual, gateway, mock."
      ])
    );
  });

  it("requires an explicit escape hatch for production mock payments", () => {
    const blocked = validateServerEnvironment(buildValidProductionEnv({ PAYMENT_MODE: "mock" }));
    const allowed = validateServerEnvironment(
      buildValidProductionEnv({ PAYMENT_MODE: "mock", ALLOW_PRODUCTION_MOCK_PAYMENTS: "true" })
    );

    expect(blocked.errors).toContain(
      "PAYMENT_MODE=mock is blocked in production unless ALLOW_PRODUCTION_MOCK_PAYMENTS=true is explicitly set."
    );
    expect(allowed.errors).toEqual([]);
  });

  it("requires gateway secrets when gateway payments are enabled", () => {
    const result = validateServerEnvironment(buildValidProductionEnv({ PAYMENT_MODE: "gateway" }));

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "PAYMONGO_SECRET_KEY must be configured when PAYMENT_MODE=gateway.",
        "PAYMONGO_PUBLIC_KEY must be configured when PAYMENT_MODE=gateway.",
        "PAYMONGO_WEBHOOK_SECRET must be configured when PAYMENT_MODE=gateway."
      ])
    );
  });
});
