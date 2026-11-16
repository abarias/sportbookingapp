CREATE TYPE "BookingRescheduleStatus" AS ENUM (
  'ADDITIONAL_PAYMENT_REQUIRED',
  'PAYMENT_SUBMITTED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "PriceAdjustmentType" AS ENUM ('SAME_PRICE', 'LOWER_PRICE', 'HIGHER_PRICE');
CREATE TYPE "PriceAdjustmentStatus" AS ENUM (
  'NONE',
  'UNRESOLVED',
  'ADDITIONAL_PAYMENT_REQUIRED',
  'SUBMITTED',
  'RESOLVED',
  'WAIVED',
  'REJECTED',
  'EXPIRED'
);
CREATE TYPE "PriceAdjustmentResolution" AS ENUM (
  'MANUAL_REFUND',
  'CUSTOMER_CREDIT',
  'NO_REFUND',
  'OTHER',
  'WAIVER'
);
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "BookingReschedule" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "originalPaymentId" TEXT,
  "originalBookingReference" TEXT NOT NULL,
  "originalFacilityId" TEXT NOT NULL,
  "originalStartAtUtc" TIMESTAMP(3) NOT NULL,
  "originalEndAtUtc" TIMESTAMP(3) NOT NULL,
  "originalTimezone" TEXT NOT NULL,
  "replacementFacilityId" TEXT NOT NULL,
  "replacementStartAtUtc" TIMESTAMP(3) NOT NULL,
  "replacementEndAtUtc" TIMESTAMP(3) NOT NULL,
  "replacementTimezone" TEXT NOT NULL,
  "originalPriceSnapshot" JSONB,
  "replacementPriceSnapshot" JSONB NOT NULL,
  "originalAmountMinor" INTEGER NOT NULL,
  "replacementAmountMinor" INTEGER NOT NULL,
  "priceDifferenceMinor" INTEGER NOT NULL,
  "waivedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  "additionalAmountDueMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "status" "BookingRescheduleStatus" NOT NULL,
  "adjustmentType" "PriceAdjustmentType" NOT NULL,
  "adjustmentStatus" "PriceAdjustmentStatus" NOT NULL,
  "holdExpiresAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "internalNote" TEXT,
  "customerNote" TEXT,
  "resolutionMethod" "PriceAdjustmentResolution",
  "resolutionAmountMinor" INTEGER,
  "resolutionReference" TEXT,
  "resolutionNote" TEXT,
  "initiatedByUserId" TEXT NOT NULL,
  "finalizedByUserId" TEXT,
  "resolvedByUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "finalizedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingReschedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingReschedule_amounts_check" CHECK (
    "originalAmountMinor" >= 0 AND "replacementAmountMinor" >= 0
    AND "waivedAmountMinor" >= 0 AND "additionalAmountDueMinor" >= 0
  ),
  CONSTRAINT "BookingReschedule_range_check" CHECK ("replacementEndAtUtc" > "replacementStartAtUtc")
);

CREATE TABLE "ReschedulePayment" (
  "id" TEXT NOT NULL,
  "bookingRescheduleId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
  "providerReference" TEXT NOT NULL,
  "method" TEXT,
  "externalReference" TEXT,
  "normalizedExternalReference" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "proofImageUrl" TEXT,
  "status" "PaymentStatus" NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReschedulePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReschedulePayment_amount_check" CHECK ("amountMinor" > 0)
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "rescheduleId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingReschedule_idempotencyKey_key" ON "BookingReschedule"("idempotencyKey");
CREATE INDEX "BookingReschedule_bookingId_createdAt_idx" ON "BookingReschedule"("bookingId", "createdAt");
CREATE INDEX "BookingReschedule_status_holdExpiresAt_idx" ON "BookingReschedule"("status", "holdExpiresAt");
CREATE INDEX "BookingReschedule_replacementFacilityId_range_idx" ON "BookingReschedule"("replacementFacilityId", "replacementStartAtUtc", "replacementEndAtUtc");
CREATE INDEX "BookingReschedule_adjustmentStatus_createdAt_idx" ON "BookingReschedule"("adjustmentStatus", "createdAt");
CREATE UNIQUE INDEX "BookingReschedule_one_active_per_booking_key" ON "BookingReschedule"("bookingId")
WHERE "status" IN ('ADDITIONAL_PAYMENT_REQUIRED', 'PAYMENT_SUBMITTED');

CREATE UNIQUE INDEX "ReschedulePayment_bookingRescheduleId_key" ON "ReschedulePayment"("bookingRescheduleId");
CREATE UNIQUE INDEX "ReschedulePayment_providerReference_key" ON "ReschedulePayment"("providerReference");
CREATE INDEX "ReschedulePayment_status_createdAt_idx" ON "ReschedulePayment"("status", "createdAt");
CREATE INDEX "ReschedulePayment_normalizedExternalReference_status_idx" ON "ReschedulePayment"("normalizedExternalReference", "status");
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");
CREATE INDEX "NotificationDelivery_bookingId_createdAt_idx" ON "NotificationDelivery"("bookingId", "createdAt");

ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_originalPaymentId_fkey" FOREIGN KEY ("originalPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_originalFacilityId_fkey" FOREIGN KEY ("originalFacilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_replacementFacilityId_fkey" FOREIGN KEY ("replacementFacilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReschedulePayment" ADD CONSTRAINT "ReschedulePayment_bookingRescheduleId_fkey" FOREIGN KEY ("bookingRescheduleId") REFERENCES "BookingReschedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReschedulePayment" ADD CONSTRAINT "ReschedulePayment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_rescheduleId_fkey" FOREIGN KEY ("rescheduleId") REFERENCES "BookingReschedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingReschedule"
  ADD CONSTRAINT "BookingReschedule_no_active_replacement_overlap"
  EXCLUDE USING gist (
    "replacementFacilityId" WITH =,
    tsrange("replacementStartAtUtc", "replacementEndAtUtc", '[)') WITH &&
  )
  WHERE ("status" IN ('ADDITIONAL_PAYMENT_REQUIRED', 'PAYMENT_SUBMITTED'));

CREATE OR REPLACE FUNCTION prevent_reschedule_hold_conflict() RETURNS trigger AS $$
BEGIN
  IF NEW."status" NOT IN ('ADDITIONAL_PAYMENT_REQUIRED', 'PAYMENT_SUBMITTED') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW."replacementFacilityId"));

  IF EXISTS (
    SELECT 1 FROM "Booking" booking
    WHERE booking."facilityId" = NEW."replacementFacilityId"
      AND booking."id" <> NEW."bookingId"
      AND booking."status" IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')
      AND tsrange(booking."startAtUtc", booking."endAtUtc", '[)')
        && tsrange(NEW."replacementStartAtUtc", NEW."replacementEndAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Replacement schedule overlaps with an active booking.' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "BlockedSchedule" blocked
    WHERE blocked."facilityId" = NEW."replacementFacilityId"
      AND tsrange(blocked."startAtUtc", blocked."endAtUtc", '[)')
        && tsrange(NEW."replacementStartAtUtc", NEW."replacementEndAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Replacement schedule overlaps with a blocked schedule.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BookingReschedule_prevent_hold_conflict"
BEFORE INSERT OR UPDATE OF "replacementFacilityId", "replacementStartAtUtc", "replacementEndAtUtc", "status"
ON "BookingReschedule" FOR EACH ROW EXECUTE FUNCTION prevent_reschedule_hold_conflict();

CREATE OR REPLACE FUNCTION prevent_booking_block_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW."status" NOT IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW."facilityId"));

  IF EXISTS (
    SELECT 1 FROM "BlockedSchedule" blocked
    WHERE blocked."facilityId" = NEW."facilityId"
      AND tsrange(blocked."startAtUtc", blocked."endAtUtc", '[)')
        && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with an existing blocked schedule.' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "BookingReschedule" reschedule
    WHERE reschedule."replacementFacilityId" = NEW."facilityId"
      AND reschedule."bookingId" <> NEW."id"
      AND (
        reschedule."status" = 'PAYMENT_SUBMITTED'
        OR (
          reschedule."status" = 'ADDITIONAL_PAYMENT_REQUIRED'
          AND reschedule."holdExpiresAt" > CURRENT_TIMESTAMP
        )
      )
      AND tsrange(reschedule."replacementStartAtUtc", reschedule."replacementEndAtUtc", '[)')
        && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with an active replacement hold.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_blocked_schedule_booking_overlap() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."facilityId"));

  IF EXISTS (
    SELECT 1 FROM "Booking" booking
    WHERE booking."facilityId" = NEW."facilityId"
      AND booking."status" IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')
      AND tsrange(booking."startAtUtc", booking."endAtUtc", '[)')
        && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Blocked schedule overlaps with an active booking.' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "BookingReschedule" reschedule
    WHERE reschedule."replacementFacilityId" = NEW."facilityId"
      AND (
        reschedule."status" = 'PAYMENT_SUBMITTED'
        OR (
          reschedule."status" = 'ADDITIONAL_PAYMENT_REQUIRED'
          AND reschedule."holdExpiresAt" > CURRENT_TIMESTAMP
        )
      )
      AND tsrange(reschedule."replacementStartAtUtc", reschedule."replacementEndAtUtc", '[)')
        && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Blocked schedule overlaps with an active replacement hold.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

INSERT INTO "Permission" ("id", "key", "displayName", "description", "category", "riskLevel", "updatedAt") VALUES
('perm_bookings_reschedule_override', 'bookings.reschedule.override_adjustment', 'Override reschedule adjustment', 'Waive all or part of an additional rescheduling amount.', 'Bookings and availability', 'CRITICAL', CURRENT_TIMESTAMP),
('perm_bookings_reschedule_resolve', 'bookings.reschedule.resolve_adjustment', 'Resolve reschedule adjustment', 'Record manual refund, customer credit, or approved no-refund outcomes.', 'Bookings and availability', 'SENSITIVE', CURRENT_TIMESTAMP);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_super_admin', "id" FROM "Permission"
WHERE "key" IN ('bookings.reschedule.override_adjustment', 'bookings.reschedule.resolve_adjustment');

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_booking_admin', "id" FROM "Permission"
WHERE "key" = 'bookings.reschedule.resolve_adjustment';

ALTER TABLE "BookingReschedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReschedulePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "BookingReschedule", "ReschedulePayment", "NotificationDelivery" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "BookingReschedule", "ReschedulePayment", "NotificationDelivery" FROM authenticated;
  END IF;
END $$;
