import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20260824110000_add_booking_rescheduling/migration.sql"),
  "utf8"
);

describe("booking rescheduling migration", () => {
  it("creates immutable reschedule and separate adjustment-payment records", () => {
    expect(migration).toContain('CREATE TABLE "BookingReschedule"');
    expect(migration).toContain('CREATE TABLE "ReschedulePayment"');
    expect(migration).toContain('"originalPriceSnapshot" JSONB');
    expect(migration).toContain('"replacementPriceSnapshot" JSONB NOT NULL');
    expect(migration).toContain('"idempotencyKey" TEXT NOT NULL');
  });

  it("prevents concurrent active replacement overlap and duplicate active requests", () => {
    expect(migration).toContain('BookingReschedule_no_active_replacement_overlap');
    expect(migration).toContain('EXCLUDE USING gist');
    expect(migration).toContain('BookingReschedule_one_active_per_booking_key');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('BookingReschedule_prevent_hold_conflict');
  });

  it("protects booking, blocked-schedule, and replacement writes in both directions", () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION prevent_booking_block_overlap()');
    expect(migration).toContain('Booking overlaps with an active replacement hold.');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION prevent_blocked_schedule_booking_overlap()');
    expect(migration).toContain('Blocked schedule overlaps with an active replacement hold.');
  });

  it("enables RLS and revokes browser-facing database roles", () => {
    expect(migration).toContain('ALTER TABLE "BookingReschedule" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "ReschedulePayment" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE "BookingReschedule", "ReschedulePayment", "NotificationDelivery" FROM anon');
    expect(migration).toContain('FROM authenticated');
  });
});
