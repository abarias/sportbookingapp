import {
  BookingRescheduleStatus,
  NotificationDeliveryStatus,
  PaymentStatus,
  PriceAdjustmentStatus
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    bookingReschedule: { findMany: vi.fn(), updateMany: vi.fn() },
    reschedulePayment: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    notificationDelivery: { upsert: vi.fn() }
  },
  prisma: { $transaction: vi.fn() }
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { expirePendingReschedules } from "./reschedule-expiration";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.bookingReschedule.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.reschedulePayment.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.auditLog.create.mockResolvedValue({});
  mocks.tx.notificationDelivery.upsert.mockResolvedValue({ status: NotificationDeliveryStatus.PENDING });
});

describe("expirePendingReschedules", () => {
  it("expires only locked unpaid replacement holds and preserves the original booking", async () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "reschedule-1" }]);
    mocks.tx.bookingReschedule.findMany.mockResolvedValue([{
      id: "reschedule-1",
      bookingId: "booking-1",
      originalBookingReference: "PG-1234",
      booking: { userId: "customer-1" }
    }]);

    const result = await expirePendingReschedules({ now });

    expect(mocks.tx.reschedulePayment.updateMany).toHaveBeenCalledWith({
      where: {
        bookingRescheduleId: { in: ["reschedule-1"] },
        status: PaymentStatus.AWAITING_PAYMENT
      },
      data: { status: PaymentStatus.EXPIRED }
    });
    expect(mocks.tx.bookingReschedule.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["reschedule-1"] },
        status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED
      },
      data: {
        status: BookingRescheduleStatus.EXPIRED,
        adjustmentStatus: PriceAdjustmentStatus.EXPIRED,
        expiredAt: now,
        holdExpiresAt: null,
        version: { increment: 1 }
      }
    });
    expect(mocks.tx).not.toHaveProperty("booking.update");
    expect(mocks.tx.notificationDelivery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ dedupeKey: "reschedule-1:hold-expired" })
    }));
    expect(result).toEqual({ expiredCount: 1, expiredIds: ["reschedule-1"] });
  });

  it("is idempotent when no rows can be locked", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);
    await expect(expirePendingReschedules()).resolves.toEqual({ expiredCount: 0, expiredIds: [] });
    expect(mocks.tx.bookingReschedule.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.notificationDelivery.upsert).not.toHaveBeenCalled();
  });
});
