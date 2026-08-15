ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'HELD';

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'ACTION_REQUIRED';

ALTER TABLE "Payment" ADD COLUMN "method" TEXT;
ALTER TABLE "Payment" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "normalizedExternalReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "amountPaidMinor" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "proofImageUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "verifiedByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "actionRequiredAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Payment" ADD COLUMN "duplicateReference" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Payment_normalizedExternalReference_status_idx" ON "Payment"("normalizedExternalReference", "status");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
