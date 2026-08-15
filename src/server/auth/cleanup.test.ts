import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    emailVerificationToken: {
      deleteMany: vi.fn()
    },
    registrationAttempt: {
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma
}));

import { cleanupAuthData, getAuthCleanupRetentionDays, subtractDays } from "./cleanup";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AUTH_VERIFICATION_TOKEN_RETENTION_DAYS;
  delete process.env.AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS;
  mocks.prisma.$transaction.mockResolvedValue([{ count: 2 }, { count: 3 }]);
});

describe("auth cleanup", () => {
  it("subtracts whole days from a date", () => {
    expect(subtractDays(new Date("2026-08-07T00:00:00.000Z"), 7).toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("uses safe default retention values", () => {
    expect(getAuthCleanupRetentionDays()).toEqual({
      verificationTokenRetentionDays: 7,
      registrationAttemptRetentionDays: 90
    });
  });

  it("uses positive integer retention env overrides", () => {
    process.env.AUTH_VERIFICATION_TOKEN_RETENTION_DAYS = "14";
    process.env.AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS = "120";

    expect(getAuthCleanupRetentionDays()).toEqual({
      verificationTokenRetentionDays: 14,
      registrationAttemptRetentionDays: 120
    });
  });

  it("ignores invalid retention env overrides", () => {
    process.env.AUTH_VERIFICATION_TOKEN_RETENTION_DAYS = "0";
    process.env.AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS = "not-a-number";

    expect(getAuthCleanupRetentionDays()).toEqual({
      verificationTokenRetentionDays: 7,
      registrationAttemptRetentionDays: 90
    });
  });

  it("deletes expired tokens and old registration attempts by cutoff", async () => {
    const result = await cleanupAuthData({
      now: new Date("2026-08-07T00:00:00.000Z"),
      verificationTokenRetentionDays: 7,
      registrationAttemptRetentionDays: 90
    });

    expect(mocks.prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: new Date("2026-07-31T00:00:00.000Z") }
      }
    });
    expect(mocks.prisma.registrationAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date("2026-05-09T00:00:00.000Z") }
      }
    });
    expect(result).toEqual({
      expiredVerificationTokensDeleted: 2,
      oldRegistrationAttemptsDeleted: 3,
      verificationTokenCutoff: new Date("2026-07-31T00:00:00.000Z"),
      registrationAttemptCutoff: new Date("2026-05-09T00:00:00.000Z")
    });
  });
});
