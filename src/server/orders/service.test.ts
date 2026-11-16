import { BookingOrderStatus, BookingStatus, PaymentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    payment: { findUnique: vi.fn(), update: vi.fn() },
    paymentAllocation: { createMany: vi.fn() },
    booking: { updateMany: vi.fn() },
    bookingOrder: { findFirst: vi.fn(), update: vi.fn() }
  },
  prisma: { $transaction: vi.fn() },
  writeAuditLog: vi.fn(),
  enqueueOrderNotification: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit/log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/notifications/orders", () => ({ enqueueOrderNotification: mocks.enqueueOrderNotification }));

import { submitOrderPaymentProof, verifyOrderPayment } from "@/server/orders/service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.payment.update.mockResolvedValue({});
  mocks.tx.paymentAllocation.createMany.mockResolvedValue({ count: 2 });
  mocks.tx.booking.updateMany.mockResolvedValue({ count: 2 });
  mocks.tx.bookingOrder.update.mockResolvedValue({ id: "order-1", status: BookingOrderStatus.CONFIRMED });
});

describe("consolidated order payments", () => {
  it("rejects proof submission when the order is not owned by the current customer", async () => {
    mocks.tx.bookingOrder.findFirst.mockResolvedValue(null);
    await expect(submitOrderPaymentProof({ bookingOrderId: "other-order", userId: "user-1", method: "manual_gcash", externalReference: "ABC123", proofImageUrl: "proof" })).rejects.toThrow(/not found/);
  });

  it("verifies one payment and confirms all child bookings atomically", async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      status: PaymentStatus.SUBMITTED,
      amountMinor: 300_000,
      currency: "PHP",
      bookingOrder: {
        id: "order-1",
        userId: "user-1",
        reference: "PG-OR-TEST",
        status: BookingOrderStatus.PROOF_SUBMITTED,
        baseAmountMinor: 300_000,
        bookings: [
          { id: "booking-1", reference: "PG-BK-1", status: BookingStatus.HELD, amountMinor: 100_000, currency: "PHP", startAtUtc: new Date(), endAtUtc: new Date(), timezone: "Asia/Manila", facility: { name: "Court 1" } },
          { id: "booking-2", reference: "PG-BK-2", status: BookingStatus.HELD, amountMinor: 200_000, currency: "PHP", startAtUtc: new Date(), endAtUtc: new Date(), timezone: "Asia/Manila", facility: { name: "Court 2" } }
        ]
      }
    });

    await verifyOrderPayment({ paymentId: "payment-1", adminUserId: "admin-1" });

    expect(mocks.tx.paymentAllocation.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ bookingId: "booking-1", amountMinor: 100_000 }),
        expect.objectContaining({ bookingId: "booking-2", amountMinor: 200_000 })
      ]
    }));
    expect(mocks.tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }));
    expect(mocks.tx.bookingOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: BookingOrderStatus.CONFIRMED, amountPaidMinor: 300_000 }) }));
    expect(mocks.enqueueOrderNotification).toHaveBeenCalledTimes(1);
  });

  it("refuses verification when child allocations do not reconcile", async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1", status: PaymentStatus.SUBMITTED, amountMinor: 300_000, currency: "PHP",
      bookingOrder: { id: "order-1", status: BookingOrderStatus.PROOF_SUBMITTED, baseAmountMinor: 300_000, bookings: [{ id: "booking-1", status: BookingStatus.HELD, amountMinor: 100_000 }] }
    });
    await expect(verifyOrderPayment({ paymentId: "payment-1", adminUserId: "admin-1" })).rejects.toThrow(/reconcile/);
    expect(mocks.tx.booking.updateMany).not.toHaveBeenCalled();
  });
});
