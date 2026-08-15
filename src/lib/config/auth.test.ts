import { beforeEach, describe, expect, it } from "vitest";

import { getAuthConfig, minutesToMilliseconds } from "./auth";

const authEnvKeys = [
  "AUTH_REGISTRATION_WINDOW_MINUTES",
  "AUTH_MAX_REGISTRATION_ATTEMPTS",
  "AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES",
  "AUTH_MAX_EMAIL_VERIFICATION_ATTEMPTS",
  "AUTH_RESEND_VERIFICATION_WINDOW_MINUTES",
  "AUTH_MAX_RESEND_VERIFICATION_ATTEMPTS",
  "AUTH_VERIFICATION_TOKEN_RETENTION_DAYS",
  "AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS"
];

beforeEach(() => {
  authEnvKeys.forEach((key) => {
    delete process.env[key];
  });
});

describe("auth config", () => {
  it("uses safe defaults", () => {
    expect(getAuthConfig()).toEqual({
      registrationWindowMinutes: 15,
      maxRegistrationAttempts: 5,
      emailVerificationExpiryMinutes: 15,
      maxEmailVerificationAttempts: 5,
      resendVerificationWindowMinutes: 10,
      maxResendVerificationAttempts: 3,
      verificationTokenRetentionDays: 7,
      registrationAttemptRetentionDays: 90
    });
  });

  it("uses positive integer environment overrides", () => {
    process.env.AUTH_REGISTRATION_WINDOW_MINUTES = "20";
    process.env.AUTH_MAX_REGISTRATION_ATTEMPTS = "7";
    process.env.AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES = "30";
    process.env.AUTH_MAX_EMAIL_VERIFICATION_ATTEMPTS = "4";
    process.env.AUTH_RESEND_VERIFICATION_WINDOW_MINUTES = "12";
    process.env.AUTH_MAX_RESEND_VERIFICATION_ATTEMPTS = "2";
    process.env.AUTH_VERIFICATION_TOKEN_RETENTION_DAYS = "14";
    process.env.AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS = "120";

    expect(getAuthConfig()).toEqual({
      registrationWindowMinutes: 20,
      maxRegistrationAttempts: 7,
      emailVerificationExpiryMinutes: 30,
      maxEmailVerificationAttempts: 4,
      resendVerificationWindowMinutes: 12,
      maxResendVerificationAttempts: 2,
      verificationTokenRetentionDays: 14,
      registrationAttemptRetentionDays: 120
    });
  });

  it("falls back for invalid environment overrides", () => {
    process.env.AUTH_REGISTRATION_WINDOW_MINUTES = "0";
    process.env.AUTH_MAX_REGISTRATION_ATTEMPTS = "-1";
    process.env.AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES = "not-a-number";

    expect(getAuthConfig()).toMatchObject({
      registrationWindowMinutes: 15,
      maxRegistrationAttempts: 5,
      emailVerificationExpiryMinutes: 15
    });
  });

  it("converts minutes to milliseconds", () => {
    expect(minutesToMilliseconds(15)).toBe(900000);
  });
});
