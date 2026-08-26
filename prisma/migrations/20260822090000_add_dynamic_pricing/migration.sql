-- Additive pricing model. Existing rules become default facility rates and
-- existing booking totals remain unchanged with a null historical snapshot.
CREATE TYPE "PricingDayType" AS ENUM ('DEFAULT', 'WEEKDAY', 'WEEKEND', 'HOLIDAY', 'SELECTED_DAYS');

ALTER TABLE "PricingRule"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Default rate',
ADD COLUMN "customerLabel" TEXT,
ADD COLUMN "dayType" "PricingDayType" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "startMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "endMinutes" INTEGER NOT NULL DEFAULT 1440,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "effectiveFrom" DATE,
ADD COLUMN "effectiveUntil" DATE,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "updatedByUserId" TEXT;

ALTER TABLE "Booking" ADD COLUMN "priceSnapshot" JSONB;

CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT,
  "name" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingRule_facilityId_isActive_dayType_idx" ON "PricingRule"("facilityId", "isActive", "dayType");
CREATE INDEX "PricingRule_facilityId_effectiveFrom_effectiveUntil_idx" ON "PricingRule"("facilityId", "effectiveFrom", "effectiveUntil");
CREATE UNIQUE INDEX "Holiday_facilityId_date_name_key" ON "Holiday"("facilityId", "date", "name");
CREATE UNIQUE INDEX "Holiday_global_date_name_key" ON "Holiday"("date", "name") WHERE "facilityId" IS NULL;
CREATE INDEX "Holiday_date_isActive_idx" ON "Holiday"("date", "isActive");
CREATE INDEX "Holiday_facilityId_date_isActive_idx" ON "Holiday"("facilityId", "date", "isActive");

ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve any legacy zero-price row during migration. The pricing engine will
-- reject it as invalid coverage, while all new/edited rules require > 0.
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_amountMinor_check" CHECK ("amountMinor" >= 0);
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_time_range_check" CHECK ("startMinutes" >= 0 AND "startMinutes" < "endMinutes" AND "endMinutes" <= 1440);
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_effective_range_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" >= "effectiveFrom");
