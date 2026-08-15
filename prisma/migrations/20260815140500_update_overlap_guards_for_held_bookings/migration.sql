ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_no_active_overlap";

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_active_overlap"
  EXCLUDE USING gist (
    "facilityId" WITH =,
    tsrange("startAtUtc", "endAtUtc", '[)') WITH &&
  )
  WHERE ("status" IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED'));

CREATE OR REPLACE FUNCTION prevent_booking_block_overlap()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" NOT IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW."facilityId"));

  IF EXISTS (
    SELECT 1
    FROM "BlockedSchedule" blocked
    WHERE blocked."facilityId" = NEW."facilityId"
      AND tsrange(blocked."startAtUtc", blocked."endAtUtc", '[)') && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with an existing blocked schedule.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_blocked_schedule_booking_overlap()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."facilityId"));

  IF EXISTS (
    SELECT 1
    FROM "Booking" booking
    WHERE booking."facilityId" = NEW."facilityId"
      AND booking."status" IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')
      AND tsrange(booking."startAtUtc", booking."endAtUtc", '[)') && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Blocked schedule overlaps with an active booking.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
