import { BookingStatus, PaymentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    booking: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    payment: {
      updateMany: vi.fn()
    }
  },
  prisma: {
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma
}));

import { expirePendingBookings } from "./expiration";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.booking.updateMany.mockResolvedValue({ count: 2 });
  mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 });
});

describe("expirePendingBookings", () => {
  it("expires overdue pending bookings and pending payments", async () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    mocks.tx.booking.findMany
      .mockResolvedValueOnce([{ id: "booking-1" }, { id: "booking-2" }])
      .mockResolvedValueOnce([{ id: "booking-1" }, { id: "booking-2" }]);

    const result = await expirePendingBookings({ now, batchSize: 50 });

    expect(mocks.tx.booking.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        paymentHoldExpiresAt: { lte: now },
        OR: [
          { payment: null },
          {
            payment: {
              status: {
                in: [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.EXPIRED]
              }
            }
          }
        ]
      },
      orderBy: { paymentHoldExpiresAt: "asc" },
      take: 50,
      select: { id: true }
    });
    expect(mocks.tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["booking-1", "booking-2"] },
        status: BookingStatus.PENDING_PAYMENT,
        paymentHoldExpiresAt: { lte: now }
      },
      data: {
        status: BookingStatus.EXPIRED
      }
    });
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: { in: ["booking-1", "booking-2"] },
        status: PaymentStatus.PENDING
      },
      data: {
        status: PaymentStatus.EXPIRED
      }
    });
    expect(result).toEqual({
      expiredBookingCount: 2,
      expiredPaymentCount: 1,
      expiredBookingIds: ["booking-1", "booking-2"]
    });
  });

  it("is safe when there are no expired candidates", async () => {
    mocks.tx.booking.findMany.mockResolvedValueOnce([]);

    const result = await expirePendingBookings({ now: new Date("2026-08-15T12:00:00.000Z") });

    expect(mocks.tx.booking.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredBookingCount: 0,
      expiredPaymentCount: 0,
      expiredBookingIds: []
    });
  });
});
