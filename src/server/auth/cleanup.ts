import { prisma } from "@/lib/db/prisma";
import { getAuthConfig } from "@/lib/config/auth";

type CleanupAuthDataOptions = {
  now?: Date;
  verificationTokenRetentionDays?: number;
  registrationAttemptRetentionDays?: number;
};

export type CleanupAuthDataResult = {
  expiredVerificationTokensDeleted: number;
  oldRegistrationAttemptsDeleted: number;
  verificationTokenCutoff: Date;
  registrationAttemptCutoff: Date;
};

export function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export function getAuthCleanupRetentionDays() {
  const authConfig = getAuthConfig();

  return {
    verificationTokenRetentionDays: authConfig.verificationTokenRetentionDays,
    registrationAttemptRetentionDays: authConfig.registrationAttemptRetentionDays
  };
}

export async function cleanupAuthData(options: CleanupAuthDataOptions = {}): Promise<CleanupAuthDataResult> {
  const now = options.now ?? new Date();
  const retention = getAuthCleanupRetentionDays();
  const verificationTokenRetentionDays =
    options.verificationTokenRetentionDays ?? retention.verificationTokenRetentionDays;
  const registrationAttemptRetentionDays =
    options.registrationAttemptRetentionDays ?? retention.registrationAttemptRetentionDays;
  const verificationTokenCutoff = subtractDays(now, verificationTokenRetentionDays);
  const registrationAttemptCutoff = subtractDays(now, registrationAttemptRetentionDays);
  const [expiredVerificationTokens, oldRegistrationAttempts] = await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: { lt: verificationTokenCutoff }
      }
    }),
    prisma.registrationAttempt.deleteMany({
      where: {
        createdAt: { lt: registrationAttemptCutoff }
      }
    })
  ]);

  return {
    expiredVerificationTokensDeleted: expiredVerificationTokens.count,
    oldRegistrationAttemptsDeleted: oldRegistrationAttempts.count,
    verificationTokenCutoff,
    registrationAttemptCutoff
  };
}
