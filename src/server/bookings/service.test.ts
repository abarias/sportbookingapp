import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    appSetting: {
      findUnique: vi.fn()
    },
    blockedSchedule: {
      findMany: vi.fn()
    },
    booking: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    facility: {
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

import { createConfirmedBookingWithMockPayment } from "./service";

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
