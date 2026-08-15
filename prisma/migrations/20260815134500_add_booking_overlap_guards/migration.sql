CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_valid_time_range"
  CHECK ("endAtUtc" > "startAtUtc");

ALTER TABLE "BlockedSchedule"
  ADD CONSTRAINT "BlockedSchedule_valid_time_range"
  CHECK ("endAtUtc" > "startAtUtc");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_active_overlap"
  EXCLUDE USING gist (
    "facilityId" WITH =,
    tsrange("startAtUtc", "endAtUtc", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED'));

ALTER TABLE "BlockedSchedule"
  ADD CONSTRAINT "BlockedSchedule_no_overlap"
  EXCLUDE USING gist (
    "facilityId" WITH =,
    tsrange("startAtUtc", "endAtUtc", '[)') WITH &&
  );

CREATE OR REPLACE FUNCTION prevent_booking_block_overlap()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" NOT IN ('PENDING_PAYMENT', 'CONFIRMED') THEN
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
      AND booking."status" IN ('PENDING_PAYMENT', 'CONFIRMED')
      AND tsrange(booking."startAtUtc", booking."endAtUtc", '[)') && tsrange(NEW."startAtUtc", NEW."endAtUtc", '[)')
  ) THEN
    RAISE EXCEPTION 'Blocked schedule overlaps with an active booking.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Booking_prevent_block_overlap"
  BEFORE INSERT OR UPDATE OF "facilityId", "status", "startAtUtc", "endAtUtc"
  ON "Booking"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_booking_block_overlap();

CREATE TRIGGER "BlockedSchedule_prevent_booking_overlap"
  BEFORE INSERT OR UPDATE OF "facilityId", "startAtUtc", "endAtUtc"
  ON "BlockedSchedule"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_blocked_schedule_booking_overlap();
