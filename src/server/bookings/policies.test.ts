import { BookingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canCustomerCancelBooking, resolveCancellationEnabled } from "./policies";

describe("resolveCancellationEnabled", () => {
  it("inherits the global policy when the facility does not override it", () => {
    expect(resolveCancellationEnabled(true, null)).toBe(true);
    expect(resolveCancellationEnabled(false, null)).toBe(false);
  });

  it("uses the facility override when present", () => {
    expect(resolveCancellationEnabled(false, true)).toBe(true);
    expect(resolveCancellationEnabled(true, false)).toBe(false);
  });
});

describe("canCustomerCancelBooking", () => {
  const now = new Date("2026-04-14T02:00:00.000Z");

  it("allows future confirmed bookings when cancellation is enabled", () => {
    expect(
      canCustomerCancelBooking({
        bookingStatus: BookingStatus.CONFIRMED,
        startAtUtc: new Date("2026-04-16T02:00:00.000Z"),
        now,
        cancellationEnabled: true
      })
    ).toBe(true);
  });

  it("rejects cancellation when the policy is disabled", () => {
    expect(
      canCustomerCancelBooking({
        bookingStatus: BookingStatus.CONFIRMED,
        startAtUtc: new Date("2026-04-16T02:00:00.000Z"),
        now,
        cancellationEnabled: false
      })
    ).toBe(false);
  });

  it("rejects past bookings and non-confirmed bookings", () => {
    expect(
      canCustomerCancelBooking({
        bookingStatus: BookingStatus.CONFIRMED,
        startAtUtc: new Date("2026-04-13T02:00:00.000Z"),
        now,
        cancellationEnabled: true
      })
    ).toBe(false);

    expect(
      canCustomerCancelBooking({
        bookingStatus: BookingStatus.CANCELLED,
        startAtUtc: new Date("2026-04-16T02:00:00.000Z"),
        now,
        cancellationEnabled: true
      })
    ).toBe(false);
  });
});
