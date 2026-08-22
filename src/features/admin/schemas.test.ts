import { describe, expect, it } from "vitest";

import { adminWalkInBookingSchema, blockedScheduleSchema, walkInCustomerSchema } from "./schemas";

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
