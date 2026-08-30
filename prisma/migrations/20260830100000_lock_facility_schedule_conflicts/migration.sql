-- Serialize booking and blocked-schedule writes through the facility row.
-- This avoids stale snapshots allowing both sides of a cross-table race to commit.
CREATE OR REPLACE FUNCTION prevent_booking_block_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW."status" NOT IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "Facility" WHERE "id" = NEW."facilityId" FOR UPDATE;
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
        OR (reschedule."status" = 'ADDITIONAL_PAYMENT_REQUIRED' AND reschedule."holdExpiresAt" > CURRENT_TIMESTAMP)
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
  PERFORM 1 FROM "Facility" WHERE "id" = NEW."facilityId" FOR UPDATE;
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
        OR (reschedule."status" = 'ADDITIONAL_PAYMENT_REQUIRED' AND reschedule."holdExpiresAt" > CURRENT_TIMESTAMP)
      )
      AND tsrange(reschedule."replacementStartAtUtc", reschedule."replacementEndAtUtc", '[)')
        && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Blocked schedule overlaps with an active replacement hold.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
