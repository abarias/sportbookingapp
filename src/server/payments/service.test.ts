import { BookingStatus, PaymentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    booking: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    payment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  },
  prisma: {
    payment: {
      update: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma
}));

import {
  normalizePaymentReference,
  rejectSubmittedPayment,
  requestPaymentAction,
  submitManualPaymentProof,
  verifySubmittedPayment
} from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.payment.update.mockResolvedValue({ id: "payment-1" });
  mocks.tx.booking.update.mockResolvedValue({ id: "booking-1" });
});

describe("manual payment service", () => {
  const futureHoldExpiresAt = () => new Date(Date.now() + 15 * 60 * 1000);

  it("normalizes external payment references", () => {
    expect(normalizePaymentReference(" gcash-123 456 ")).toBe("GCASH123456");
  });

  it("submits proof without confirming the booking", async () => {
    mocks.tx.booking.findFirst.mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      status: BookingStatus.HELD,
      paymentHoldExpiresAt: futureHoldExpiresAt(),
      payment: { status: PaymentStatus.AWAITING_PAYMENT }
    });
    mocks.tx.payment.findFirst.mockResolvedValue(null);

    await submitManualPaymentProof({
      bookingId: "booking-1",
      userId: "user-1",
      method: "manual_gcash",
      amountPaidMinor: 100000,
      externalReference: "abc-123",
      paidAt: new Date("2026-08-16T00:10:00.000Z"),
      proofImageUrl: "/uploads/payment-proofs/proof.jpg"
    });

    expect(mocks.tx.payment.update).toHaveBeenCalledWith({
      where: { bookingId: "booking-1" },
      data: expect.objectContaining({
        status: PaymentStatus.SUBMITTED,
        normalizedExternalReference: "ABC123",
        duplicateReference: false,
        proofImageUrl: "/uploads/payment-proofs/proof.jpg"
      })
    });
    expect(mocks.tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { paymentHoldExpiresAt: null }
    });
  });

  it("flags duplicate submitted or verified payment references", async () => {
    mocks.tx.booking.findFirst.mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      status: BookingStatus.HELD,
      paymentHoldExpiresAt: futureHoldExpiresAt(),
      payment: { status: PaymentStatus.AWAITING_PAYMENT }
    });
    mocks.tx.payment.findFirst.mockResolvedValue({ id: "other-payment" });

    await submitManualPaymentProof({
      bookingId: "booking-1",
      userId: "user-1",
      method: "manual_bank_transfer",
      amountPaidMinor: 100000,
      externalReference: "duplicate-ref",
      paidAt: new Date("2026-08-16T00:10:00.000Z"),
      proofImageUrl: "/uploads/payment-proofs/proof.jpg"
    });

    expect(mocks.tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duplicateReference: true })
      })
    );
  });

  it("verifies payment and confirms the booking", async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      bookingId: "booking-1",
      status: PaymentStatus.SUBMITTED,
      booking: { id: "booking-1" }
    });

    await verifySubmittedPayment({
      paymentId: "payment-1",
      adminUserId: "admin-1",
      reviewNote: "Matched GCash"
    });

    expect(mocks.tx.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: PaymentStatus.VERIFIED,
        verifiedByUserId: "admin-1"
      })
    });
    expect(mocks.tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentHoldExpiresAt: null
      }
    });
  });

  it("rejects payment without confirming the booking", async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      bookingId: "booking-1",
      status: PaymentStatus.SUBMITTED,
      booking: { id: "booking-1" }
    });

    await rejectSubmittedPayment({
      paymentId: "payment-1",
      adminUserId: "admin-1",
      reviewNote: "Wrong amount"
    });

    expect(mocks.tx.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: PaymentStatus.REJECTED,
        reviewNote: "Wrong amount"
      })
    });
    expect(mocks.tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: {
        status: BookingStatus.EXPIRED,
        cancellationReason: "Payment proof rejected by admin",
        paymentHoldExpiresAt: null
      }
    });
  });

  it("marks payment as action required while preserving the booking hold", async () => {
    mocks.prisma.payment.update.mockResolvedValue({ id: "payment-1" });

    await requestPaymentAction({
      paymentId: "payment-1",
      adminUserId: "admin-1",
      reviewNote: "Upload clearer receipt"
    });

    expect(mocks.prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: PaymentStatus.ACTION_REQUIRED,
        verifiedByUserId: "admin-1",
        reviewNote: "Upload clearer receipt"
      })
    });
  });
});
