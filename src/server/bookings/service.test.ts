import { Prisma, PricingBillingMode, PricingDayType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    appSetting: {
      findUnique: vi.fn()
    },
    blockedSchedule: {
      findMany: vi.fn()
    },
    holiday: {
      findMany: vi.fn()
    },
    booking: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    facility: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  },
  prisma: {
    booking: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma
}));

import { createBookingHold, createConfirmedBookingWithMockPayment } from "./service";

const bookingInput = {
  userId: "user-1",
  facilityId: "facility-1",
  dateKey: "2026-08-20",
  startMinutes: 600,
  durationMinutes: 60,
  idempotencyKey: "3f784b60-1a2f-4de4-9f23-a2e60fbd6ccf"
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PAYMENT_MODE;
  delete process.env.AUTH_STRICT_ENV_VALIDATION;
  delete process.env.VERCEL_ENV;
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
});

describe("createConfirmedBookingWithMockPayment idempotency", () => {
  it("returns an existing booking for a repeated idempotency key", async () => {
    const existingBooking = {
      id: "booking-1",
      userId: bookingInput.userId,
      payment: { id: "payment-1" }
    };
    mocks.tx.booking.findUnique.mockResolvedValue(existingBooking);

    const result = await createConfirmedBookingWithMockPayment(bookingInput);

    expect(result).toBe(existingBooking);
    expect(mocks.tx.booking.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: bookingInput.idempotencyKey },
      include: { payment: true }
    });
    expect(mocks.tx.facility.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.booking.create).not.toHaveBeenCalled();
  });

  it("returns the existing booking if a simultaneous duplicate hits the unique constraint", async () => {
    const existingBooking = {
      id: "booking-1",
      userId: bookingInput.userId,
      payment: { id: "payment-1" }
    };
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["idempotencyKey"] }
    });

    mocks.prisma.$transaction.mockRejectedValue(uniqueError);
    mocks.prisma.booking.findUnique.mockResolvedValue(existingBooking);

    const result = await createConfirmedBookingWithMockPayment(bookingInput);

    expect(result).toBe(existingBooking);
    expect(mocks.prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: bookingInput.idempotencyKey },
      include: { payment: true }
    });
  });
});

describe("createBookingHold pricing authority", () => {
  it("ignores browser pricing and stores the server-calculated snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T00:00:00.000Z"));
    mocks.tx.booking.findUnique.mockResolvedValue(null);
    mocks.tx.booking.findMany.mockResolvedValue([]);
    mocks.tx.user.findUnique.mockResolvedValue({ id: bookingInput.userId });
    mocks.tx.appSetting.findUnique.mockResolvedValue({ value: 15 });
    mocks.tx.blockedSchedule.findMany.mockResolvedValue([]);
    mocks.tx.holiday.findMany.mockResolvedValue([]);
    mocks.tx.facility.findUnique.mockResolvedValue({
      id: bookingInput.facilityId,
      isEnabled: true,
      timezone: "Asia/Manila",
      slotIntervalMinutes: 30,
      operatingHours: [{ dayOfWeek: 4, opensAtMinutes: 480, closesAtMinutes: 1320, isClosed: false }],
      pricingRules: [
        { id: "default", facilityId: bookingInput.facilityId, name: "Default", customerLabel: null, dayType: PricingDayType.DEFAULT, daysOfWeek: [], startMinutes: 0, endMinutes: 1440, currency: "PHP", amountMinor: 100000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, effectiveFrom: null, effectiveUntil: null, isActive: true, displayOrder: 0, createdByUserId: null, updatedByUserId: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "weekday", facilityId: bookingInput.facilityId, name: "Weekday", customerLabel: "Weekday base rate", dayType: PricingDayType.WEEKDAY, daysOfWeek: [], startMinutes: 480, endMinutes: 1020, currency: "PHP", amountMinor: 150000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, effectiveFrom: null, effectiveUntil: null, isActive: true, displayOrder: 1, createdByUserId: null, updatedByUserId: null, createdAt: new Date(), updatedAt: new Date() }
      ]
    });
    mocks.tx.booking.create.mockImplementation(({ data }) => Promise.resolve({ id: "booking-created", ...data }));

    await createBookingHold({ ...bookingInput, amountMinor: 1 } as Parameters<typeof createBookingHold>[0]);

    expect(mocks.tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amountMinor: 150000,
        currency: "PHP",
        priceSnapshot: expect.objectContaining({ amountMinor: 150000, vatTreatment: "EXCLUSIVE" })
      })
    }));
    vi.useRealTimers();
  });
});
