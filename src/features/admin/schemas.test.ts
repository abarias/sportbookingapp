import { describe, expect, it } from "vitest";

import { blockedScheduleSchema } from "./schemas";

describe("blockedScheduleSchema", () => {
  it("accepts a valid multi-day date-time block", () => {
    const parsed = blockedScheduleSchema.safeParse({
      facilityId: "facility_123",
      title: "Private event",
      reason: "Corporate booking",
      startDate: "2026-04-20",
      endDate: "2026-04-21",
      startTime: "08:00",
      endTime: "18:00"
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects blank or reversed date-time input", () => {
    const parsed = blockedScheduleSchema.safeParse({
      facilityId: "",
      title: "",
      reason: "Test",
      startDate: "2026-04-21",
      endDate: "2026-04-20",
      startTime: "18:00",
      endTime: "08:00"
    });

    expect(parsed.success).toBe(false);
  });
});
