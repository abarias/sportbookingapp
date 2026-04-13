import { describe, expect, it } from "vitest";

import { buildDaySlots, canFitDuration, rangesOverlap, rangesOverlapByMinute } from "./core";

describe("rangesOverlap", () => {
  it("returns true for intersecting utc ranges", () => {
    expect(
      rangesOverlap(
        new Date("2026-04-18T10:00:00.000Z"),
        new Date("2026-04-18T11:00:00.000Z"),
        new Date("2026-04-18T10:30:00.000Z"),
        new Date("2026-04-18T11:30:00.000Z")
      )
    ).toBe(true);
  });

  it("returns false for touching but non-overlapping ranges", () => {
    expect(
      rangesOverlap(
        new Date("2026-04-18T10:00:00.000Z"),
        new Date("2026-04-18T11:00:00.000Z"),
        new Date("2026-04-18T11:00:00.000Z"),
        new Date("2026-04-18T12:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("buildDaySlots", () => {
  it("marks booked and blocked intervals as unavailable", () => {
    const slots = buildDaySlots({
      openingRange: { startMinutes: 8 * 60, endMinutes: 11 * 60 },
      slotIntervalMinutes: 30,
      busyIntervals: [
        { startMinutes: 8 * 60 + 30, endMinutes: 9 * 60 + 30, reason: "BOOKED" },
        { startMinutes: 10 * 60, endMinutes: 10 * 60 + 30, reason: "BLOCKED" }
      ]
    });

    expect(slots).toHaveLength(6);
    expect(slots.filter((slot) => slot.isAvailable)).toHaveLength(3);
    expect(slots[1]?.reason).toBe("BOOKED");
    expect(slots[4]?.reason).toBe("BLOCKED");
  });
});

describe("canFitDuration", () => {
  it("returns true only when consecutive open slots satisfy the requested duration", () => {
    const slots = buildDaySlots({
      openingRange: { startMinutes: 8 * 60, endMinutes: 11 * 60 },
      slotIntervalMinutes: 30,
      busyIntervals: [{ startMinutes: 9 * 60, endMinutes: 9 * 60 + 30, reason: "BOOKED" }]
    });

    expect(canFitDuration(slots, 8 * 60, 60, 30)).toBe(true);
    expect(canFitDuration(slots, 8 * 60 + 30, 60, 30)).toBe(false);
  });

  it("uses minute overlap semantics consistently", () => {
    expect(
      rangesOverlapByMinute(
        { startMinutes: 8 * 60, endMinutes: 9 * 60 },
        { startMinutes: 8 * 60 + 30, endMinutes: 9 * 60 + 30 }
      )
    ).toBe(true);
  });

  it("rejects a duration when the requested start slot does not exist", () => {
    const slots = buildDaySlots({
      openingRange: { startMinutes: 8 * 60, endMinutes: 10 * 60 },
      slotIntervalMinutes: 30,
      busyIntervals: []
    });

    expect(canFitDuration(slots, 7 * 60, 60, 30)).toBe(false);
  });
});
