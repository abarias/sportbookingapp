import { describe, expect, it } from "vitest";

import { adminWalkInBookingSchema, blockedScheduleSchema, facilityCreateSchema, facilityUpdateSchema, walkInCustomerSchema } from "./schemas";

const invalidOperatingHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAtMinutes: dayOfWeek === 1 ? 1320 : 480,
  closesAtMinutes: dayOfWeek === 1 ? 480 : 1320,
  isClosed: false
}));

const facilitySchemaBase = {
  name: "Test Facility",
  description: "A valid facility description for testing.",
  isEnabled: true,
  amountMinor: 100000,
  imageUrls: ["/facility_photos/test.jpg"],
  cancellationEnabledOverride: "inherit" as const,
  operatingHours: invalidOperatingHours
};

describe("facility operating hour validation", () => {
  it("rejects overlapping open and close times for both create and update", () => {
    expect(facilityCreateSchema.safeParse({ ...facilitySchemaBase, slug: "test-facility", type: "OTHER" }).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ ...facilitySchemaBase, facilityId: "facility_123" }).success).toBe(false);
  });

  it("allows a reversed time range when the day is closed", () => {
    const closedHours = invalidOperatingHours.map((hour) => hour.dayOfWeek === 1 ? { ...hour, isClosed: true } : hour);
    expect(facilityCreateSchema.safeParse({ ...facilitySchemaBase, operatingHours: closedHours, slug: "test-facility", type: "OTHER" }).success).toBe(true);
  });
});

describe("blockedScheduleSchema", () => {
  it("accepts a valid multi-day date-time block", () => {
    const parsed = blockedScheduleSchema.safeParse({
      facilityId: "facility_123",
      title: "Private event",
      reason: "Corporate booking",
      startDate: "2026-04-20",
      endDate: "2026-04-21",
      startTime: "08:00",
      endTime: "18:00",
      allDay: false
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
      endTime: "08:00",
      allDay: false
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts an all-day block with a same-day end date", () => {
    const parsed = blockedScheduleSchema.safeParse({
      facilityId: "facility_123",
      title: "Holiday closure",
      reason: "Facility unavailable",
      startDate: "2026-04-20",
      endDate: "2026-04-20",
      startTime: "00:00",
      endTime: "24:00",
      allDay: true
    });

    expect(parsed.success).toBe(true);
  });
});

describe("walk-in booking schemas", () => {
  const customer = {
    fullName: "Walk-in Player",
    email: "player@example.com",
    phone: "09171234567"
  };

  it("requires email and mobile number before allowing customer lookup", () => {
    expect(walkInCustomerSchema.safeParse({ fullName: customer.fullName }).success).toBe(false);
    expect(walkInCustomerSchema.safeParse(customer).success).toBe(true);
  });

  it("requires a payment reference for non-cash walk-in payments", () => {
    const baseBooking = {
      ...customer,
      facilityId: "facility_123",
      dateKey: "2026-08-20",
      startTime: "10:00",
      durationMinutes: 60
    };

    expect(adminWalkInBookingSchema.safeParse({ ...baseBooking, paymentMethod: "cash", paymentReference: "" }).success).toBe(true);
    expect(adminWalkInBookingSchema.safeParse({ ...baseBooking, paymentMethod: "manual_gcash", paymentReference: "" }).success).toBe(false);
    expect(adminWalkInBookingSchema.safeParse({ ...baseBooking, paymentMethod: "manual_gcash", paymentReference: "GCASH-1234" }).success).toBe(true);
  });
});
