import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    rateLimitBucket: {
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/security/request", () => ({ getRequestIpHash: vi.fn().mockResolvedValue("ip-hash") }));

import { cleanupExpiredRateLimitBuckets, enforceRateLimit } from "./rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RATE_LIMIT_DISABLED;
  mocks.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
});

describe("database-backed rate limiting", () => {
  it("allows attempts through the configured limit", async () => {
    mocks.upsert.mockResolvedValueOnce({ attempts: 3 });

    await expect(enforceRateLimit({
      action: "booking.create",
      subjects: ["user:user-1"],
      policy: { limit: 3, windowSeconds: 60 },
      now: new Date("2026-08-28T00:00:30.000Z")
    })).resolves.toBeUndefined();

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { action_subjectHash_windowStart: expect.objectContaining({ action: "booking.create", windowStart: new Date("2026-08-28T00:00:00.000Z") }) },
      update: { attempts: { increment: 1 }, expiresAt: new Date("2026-08-28T00:02:00.000Z") }
    }));
  });

  it("rejects any subject that exceeds the configured limit", async () => {
    mocks.upsert.mockResolvedValueOnce({ attempts: 4 });

    await expect(enforceRateLimit({
      action: "booking.create",
      subjects: ["user:user-1"],
      policy: { limit: 3, windowSeconds: 60 },
      now: new Date("2026-08-28T00:00:30.000Z")
    })).rejects.toMatchObject({
      name: "RateLimitExceededError",
      retryAt: new Date("2026-08-28T00:01:00.000Z")
    });
  });

  it("deletes expired buckets for bounded storage", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 12 });
    await expect(cleanupExpiredRateLimitBuckets(new Date("2026-08-28T00:00:00.000Z"))).resolves.toBe(12);
  });
});
