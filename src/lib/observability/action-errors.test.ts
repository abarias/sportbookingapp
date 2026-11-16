import { afterEach, describe, expect, it, vi } from "vitest";

import { getSafeActionError } from "./action-errors";

afterEach(() => vi.restoreAllMocks());

describe("safe action errors", () => {
  it("returns a generic message for technical errors and logs diagnostics", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("Invalid `prisma.booking.create()` invocation: Invalid Date");

    expect(getSafeActionError(error, "Booking could not be created.", "booking.create.failed", { bookingId: "booking-1" })).toBe(
      "Booking could not be created."
    );

    const record = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(record).toMatchObject({ event: "booking.create.failed", errorName: "Error", errorMessage: error.message });
  });

  it("preserves expected domain messages while logging them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(getSafeActionError(new Error("This time slot is no longer available."), "Booking failed.", "booking.conflict")).toBe(
      "This time slot is no longer available."
    );
    expect(spy).toHaveBeenCalledOnce();
  });
});
