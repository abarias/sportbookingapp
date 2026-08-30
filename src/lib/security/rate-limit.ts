import crypto from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import type { RateLimitPolicy } from "@/lib/config/rate-limits";
import { isStrictProductionEnvironment } from "@/lib/config/env";
import { getRequestIpHash } from "@/lib/security/request";

export class RateLimitExceededError extends Error {
  readonly retryAt: Date;

  constructor(retryAt: Date) {
    super("Too many attempts. Please wait a few minutes and try again.");
    this.name = "RateLimitExceededError";
    this.retryAt = retryAt;
  }
}

function hashSubject(subject: string) {
  const pepper = process.env.NEXTAUTH_SECRET ?? "development-rate-limit-secret";
  return crypto.createHash("sha256").update(`${pepper}:${subject}`).digest("hex");
}

function isDisabled() {
  return process.env.RATE_LIMIT_DISABLED === "true" && !isStrictProductionEnvironment();
}

export async function enforceRateLimit(input: {
  action: string;
  subjects: string[];
  policy: RateLimitPolicy;
  now?: Date;
}) {
  if (isDisabled()) return;

  const now = input.now ?? new Date();
  const windowMilliseconds = input.policy.windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
  const expiresAt = new Date(windowStart.getTime() + windowMilliseconds * 2);
  const subjectHashes = [...new Set(input.subjects.filter(Boolean).map(hashSubject))];
  if (subjectHashes.length === 0) throw new Error("A rate-limit subject is required.");

  const buckets = await prisma.$transaction(
    subjectHashes.map((subjectHash) => prisma.rateLimitBucket.upsert({
      where: {
        action_subjectHash_windowStart: {
          action: input.action,
          subjectHash,
          windowStart
        }
      },
      create: {
        action: input.action,
        subjectHash,
        windowStart,
        expiresAt
      },
      update: {
        attempts: { increment: 1 },
        expiresAt
      },
      select: { attempts: true }
    }))
  );

  if (buckets.some((bucket) => bucket.attempts > input.policy.limit)) {
    throw new RateLimitExceededError(new Date(windowStart.getTime() + windowMilliseconds));
  }
}

export async function enforceRequestRateLimit(input: {
  action: string;
  policy: RateLimitPolicy;
  userId?: string;
  anonymousKey?: string;
}) {
  const ipHash = await getRequestIpHash();
  await enforceRateLimit({
    action: input.action,
    policy: input.policy,
    subjects: [
      `ip:${ipHash}`,
      input.userId ? `user:${input.userId}` : "",
      input.anonymousKey ? `anonymous:${input.anonymousKey.trim().toLowerCase()}` : ""
    ]
  });
}

export async function cleanupExpiredRateLimitBuckets(now = new Date()) {
  const result = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}
