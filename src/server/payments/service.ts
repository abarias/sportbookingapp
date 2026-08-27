import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ManualPaymentMethod = "manual_gcash" | "manual_bank_transfer";

export function normalizePaymentReference(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function submitManualPaymentProof(input: {
  bookingId: string;
  userId: string;
  method: ManualPaymentMethod;
  externalReference: string;
  proofImageUrl: string;
}) {
  const now = new Date();
  const normalizedReference = normalizePaymentReference(input.externalReference);

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        id: input.bookingId,
        userId: input.userId
      },
      include: {
        payment: true
      }
    });

    if (!booking || !booking.payment) {
      throw new Error("Booking payment record was not found.");
    }

    if (booking.status !== BookingStatus.HELD) {
      throw new Error("Payment proof can only be submitted for an active reservation hold.");
    }

    if (
      booking.payment.status === PaymentStatus.AWAITING_PAYMENT &&
      booking.paymentHoldExpiresAt &&
      booking.paymentHoldExpiresAt <= now
    ) {
      throw new Error("This reservation hold has expired. Please create a new booking. If payment has already been made, please contact MMG Stellar support.");
    }

    if (booking.payment.status !== PaymentStatus.AWAITING_PAYMENT && booking.payment.status !== PaymentStatus.ACTION_REQUIRED) {
      throw new Error("Payment proof cannot be submitted for this payment state.");
    }

    const duplicatePayment = await tx.payment.findFirst({
      where: {
        bookingId: { not: booking.id },
        normalizedExternalReference: normalizedReference,
        status: {
          in: [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.ACTION_REQUIRED]
        }
      },
      select: { id: true }
    });

    const payment = await tx.payment.update({
      where: { bookingId: booking.id },
      data: {
        method: input.method,
        externalReference: input.externalReference.trim(),
        normalizedExternalReference: normalizedReference,
        amountPaidMinor: booking.amountMinor,
        proofImageUrl: input.proofImageUrl,
        paidAt: now,
        submittedAt: now,
        status: PaymentStatus.SUBMITTED,
        duplicateReference: Boolean(duplicatePayment),
        reviewNote: null,
        rejectedAt: null,
        actionRequiredAt: null
      }
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentHoldExpiresAt: null
      }
    });

    return payment;
  });
}

export async function verifySubmittedPayment(input: {
  paymentId: string;
  adminUserId: string;
  reviewNote?: string;
}) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { booking: true }
    });

    if (!payment?.booking || payment.status !== PaymentStatus.SUBMITTED) {
      throw new Error("Only submitted payments can be verified.");
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.VERIFIED,
        verifiedAt: now,
        verifiedByUserId: input.adminUserId,
        reviewNote: input.reviewNote?.trim() || null
      }
    });

    return tx.booking.update({
      where: { id: payment.booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentHoldExpiresAt: null
      }
    });
  });
}

export async function rejectSubmittedPayment(input: {
  paymentId: string;
  adminUserId: string;
  reviewNote: string;
}) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { booking: true }
    });

    if (!payment?.booking || payment.status !== PaymentStatus.SUBMITTED) {
      throw new Error("Only submitted payments can be rejected.");
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REJECTED,
        rejectedAt: now,
        verifiedByUserId: input.adminUserId,
        reviewNote: input.reviewNote.trim()
      }
    });

    return tx.booking.update({
      where: { id: payment.booking.id },
      data: {
        status: BookingStatus.EXPIRED,
        cancellationReason: "Payment proof rejected by admin",
        paymentHoldExpiresAt: null
      }
    });
  });
}

export async function requestPaymentAction(input: {
  paymentId: string;
  adminUserId: string;
  reviewNote: string;
}) {
  const now = new Date();

  return prisma.payment.update({
    where: { id: input.paymentId },
    data: {
      status: PaymentStatus.ACTION_REQUIRED,
      actionRequiredAt: now,
      verifiedByUserId: input.adminUserId,
      reviewNote: input.reviewNote.trim()
    }
  });
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
