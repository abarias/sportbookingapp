-- Add email verification state for first-party credentials registration.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "ipHash" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_emailVerifiedAt_idx" ON "User"("emailVerifiedAt");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
CREATE INDEX "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");
CREATE INDEX "RegistrationAttempt_email_createdAt_idx" ON "RegistrationAttempt"("email", "createdAt");
CREATE INDEX "RegistrationAttempt_ipHash_createdAt_idx" ON "RegistrationAttempt"("ipHash", "createdAt");
CREATE INDEX "RegistrationAttempt_outcome_createdAt_idx" ON "RegistrationAttempt"("outcome", "createdAt");

ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAttempt" ADD CONSTRAINT "RegistrationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
