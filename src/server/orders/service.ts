import {
  BookingOrderStatus,
  BookingStatus,
  PaymentStatus,
  Prisma
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { enqueueOrderNotification } from "@/lib/notifications/orders";
import { formatDateTimeRange } from "@/lib/time/slots";
import { normalizePaymentReference, type ManualPaymentMethod } from "@/server/payments/service";
import { assertBookingOrderTransition, assertPaymentAllocationsReconcile } from "@/server/orders/policy";

const orderInclude = {
  payment: { include: { verifiedBy: { select: { fullName: true } }, allocations: true } },
  bookings: {
    orderBy: { orderItemSequence: "asc" as const },
    include: {
      facility: { select: { id: true, name: true, slug: true, timezone: true } },
      reschedules: { orderBy: { createdAt: "desc" as const }, take: 1 }
    }
  }
};

export async function getCustomerOrder(userId: string, orderId: string) {
  return prisma.bookingOrder.findFirst({ where: { id: orderId, userId }, include: orderInclude });
}

export async function getCustomerOrders(userId: string) {
  return prisma.bookingOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: orderInclude
  });
}

function orderScheduleLines(order: Awaited<ReturnType<typeof getCustomerOrder>>) {
  if (!order) return [];
  return order.bookings.map((booking) =>
    `${booking.reference}: ${booking.facility.name}, ${formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}`
  );
}

export async function submitOrderPaymentProof(input: {
  bookingOrderId: string;
  userId: string;
  method: ManualPaymentMethod;
  externalReference: string;
  proofImageUrl: string;
}) {
  const now = new Date();
  const normalizedReference = normalizePaymentReference(input.externalReference);

  return prisma.$transaction(async (tx) => {
    const order = await tx.bookingOrder.findFirst({
      where: { id: input.bookingOrderId, userId: input.userId },
      include: { payment: true, bookings: { include: { facility: { select: { name: true } } }, orderBy: { orderItemSequence: "asc" } } }
    });
    if (!order?.payment) throw new Error("Booking order payment was not found.");
    if (order.status !== BookingOrderStatus.PENDING_PAYMENT && order.status !== BookingOrderStatus.ACTION_REQUIRED) {
      throw new Error("Payment proof cannot be submitted for this order state.");
    }
    if (order.status === BookingOrderStatus.PENDING_PAYMENT && order.paymentDeadline && order.paymentDeadline <= now) {
      throw new Error("This booking order has expired. Please create a new checkout.");
    }
    if (order.payment.status !== PaymentStatus.AWAITING_PAYMENT && order.payment.status !== PaymentStatus.ACTION_REQUIRED) {
      throw new Error("Payment proof cannot be submitted for this payment state.");
    }
    assertBookingOrderTransition(order.status, BookingOrderStatus.PROOF_SUBMITTED);

    const [duplicatePayment, duplicateReschedulePayment] = await Promise.all([
      tx.payment.findFirst({
        where: {
          id: { not: order.payment.id },
          normalizedExternalReference: normalizedReference,
          status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.ACTION_REQUIRED] }
        },
        select: { id: true }
      }),
      tx.reschedulePayment.findFirst({
        where: {
          normalizedExternalReference: normalizedReference,
          status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.ACTION_REQUIRED] }
        },
        select: { id: true }
      })
    ]);

    await tx.payment.update({
      where: { id: order.payment.id },
      data: {
        method: input.method,
        externalReference: input.externalReference.trim(),
        normalizedExternalReference: normalizedReference,
        amountPaidMinor: order.baseAmountMinor,
        proofImageUrl: input.proofImageUrl,
        paidAt: now,
        submittedAt: now,
        status: PaymentStatus.SUBMITTED,
        duplicateReference: Boolean(duplicatePayment || duplicateReschedulePayment),
        reviewNote: null,
        rejectedAt: null,
        actionRequiredAt: null
      }
    });
    const updated = await tx.bookingOrder.update({
      where: { id: order.id },
      data: { status: BookingOrderStatus.PROOF_SUBMITTED, proofSubmittedAt: now, version: { increment: 1 } }
    });
    await writeAuditLog(tx, {
      actorUserId: input.userId,
      action: "booking_order.payment_proof_submitted",
      entityType: "BookingOrder",
      entityId: order.id,
      metadata: { paymentId: order.payment.id, duplicateReference: Boolean(duplicatePayment || duplicateReschedulePayment) }
    });
    await enqueueOrderNotification(tx, {
      dedupeKey: `${order.id}:proof-submitted:${order.payment.id}`,
      userId: order.userId,
      bookingOrderId: order.id,
      eventType: "BOOKING_ORDER_PROOF_SUBMITTED",
      payload: {
        subject: `Payment proof received for ${order.reference}`,
        heading: "Consolidated payment submitted for verification",
        lines: [
          `Order reference: ${order.reference}`,
          `VAT-exclusive amount: ${formatCurrency(order.baseAmountMinor, "PHP")}`,
          `${order.bookings.length} booking${order.bookings.length === 1 ? "" : "s"} are held while staff reviews your proof.`,
          "Uploading proof does not confirm the bookings."
        ]
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function verifyOrderPayment(input: { paymentId: string; adminUserId: string; reviewNote?: string }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        bookingOrder: {
          include: {
            bookings: { include: { facility: { select: { name: true } } }, orderBy: { orderItemSequence: "asc" } }
          }
        }
      }
    });
    const order = payment?.bookingOrder;
    if (!payment || !order || payment.status !== PaymentStatus.SUBMITTED || order.status !== BookingOrderStatus.PROOF_SUBMITTED) {
      throw new Error("Only submitted consolidated payments can be verified.");
    }
    if (order.bookings.length === 0 || order.bookings.some((booking) => booking.status !== BookingStatus.HELD)) {
      throw new Error("The order bookings are no longer in a verifiable state.");
    }
    assertBookingOrderTransition(order.status, BookingOrderStatus.CONFIRMED);
    assertPaymentAllocationsReconcile({ paymentAmountMinor: payment.amountMinor, orderAmountMinor: order.baseAmountMinor, bookingAmountsMinor: order.bookings.map((booking) => booking.amountMinor) });

    await tx.paymentAllocation.createMany({
      data: order.bookings.map((booking) => ({
        paymentId: payment.id,
        bookingOrderId: order.id,
        bookingId: booking.id,
        amountMinor: booking.amountMinor,
        currency: booking.currency
      })),
      skipDuplicates: true
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.VERIFIED, verifiedAt: now, verifiedByUserId: input.adminUserId, reviewNote: input.reviewNote?.trim() || null, amountPaidMinor: payment.amountMinor }
    });
    const confirmed = await tx.booking.updateMany({
      where: { bookingOrderId: order.id, status: BookingStatus.HELD },
      data: { status: BookingStatus.CONFIRMED, paymentHoldExpiresAt: null }
    });
    if (confirmed.count !== order.bookings.length) throw new Error("Not all order bookings could be confirmed.");

    const updated = await tx.bookingOrder.update({
      where: { id: order.id },
      data: {
        status: BookingOrderStatus.CONFIRMED,
        amountPaidMinor: payment.amountMinor,
        outstandingAmountMinor: 0,
        verifiedAt: now,
        version: { increment: 1 }
      }
    });
    await writeAuditLog(tx, {
      actorUserId: input.adminUserId,
      action: "booking_order.payment_verified",
      entityType: "BookingOrder",
      entityId: order.id,
      before: { status: order.status },
      after: { status: BookingOrderStatus.CONFIRMED, paymentId: payment.id, allocationCount: order.bookings.length },
      metadata: { reviewNote: input.reviewNote?.trim() || null }
    });
    await enqueueOrderNotification(tx, {
      dedupeKey: `${order.id}:payment-verified`,
      userId: order.userId,
      bookingOrderId: order.id,
      eventType: "BOOKING_ORDER_CONFIRMED",
      payload: {
        subject: `Booking order ${order.reference} confirmed`,
        heading: "Your consolidated booking is confirmed",
        lines: [
          `Order reference: ${order.reference}`,
          `Verified VAT-exclusive payment: ${formatCurrency(payment.amountMinor, "PHP")}`,
          ...order.bookings.map((booking) => `${booking.reference}: ${booking.facility.name}, ${formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}`)
        ]
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function rejectOrderPayment(input: { paymentId: string; adminUserId: string; reviewNote: string }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { bookingOrder: { include: { bookings: true } } } });
    const order = payment?.bookingOrder;
    if (!payment || !order || payment.status !== PaymentStatus.SUBMITTED || order.status !== BookingOrderStatus.PROOF_SUBMITTED) {
      throw new Error("Only submitted consolidated payments can be rejected.");
    }
    assertBookingOrderTransition(order.status, BookingOrderStatus.PAYMENT_REJECTED);
    await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REJECTED, rejectedAt: now, verifiedByUserId: input.adminUserId, reviewNote: input.reviewNote.trim() } });
    await tx.booking.updateMany({ where: { bookingOrderId: order.id, status: BookingStatus.HELD }, data: { status: BookingStatus.EXPIRED, paymentHoldExpiresAt: null, cancellationReason: "Consolidated payment proof rejected by admin" } });
    const updated = await tx.bookingOrder.update({ where: { id: order.id }, data: { status: BookingOrderStatus.PAYMENT_REJECTED, rejectedAt: now, version: { increment: 1 } } });
    await writeAuditLog(tx, { actorUserId: input.adminUserId, action: "booking_order.payment_rejected", entityType: "BookingOrder", entityId: order.id, before: { status: order.status }, after: { status: BookingOrderStatus.PAYMENT_REJECTED }, metadata: { reason: input.reviewNote.trim() } });
    await enqueueOrderNotification(tx, { dedupeKey: `${order.id}:payment-rejected`, userId: order.userId, bookingOrderId: order.id, eventType: "BOOKING_ORDER_PAYMENT_REJECTED", payload: { subject: `Payment proof rejected for ${order.reference}`, heading: "Your consolidated payment proof was not accepted", lines: [`Order reference: ${order.reference}`, input.reviewNote.trim(), "All temporary booking holds in this order have been released."] } });
    return updated;
  });
}

export async function requestOrderPaymentAction(input: { paymentId: string; adminUserId: string; reviewNote: string }) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { bookingOrder: true } });
    const order = payment?.bookingOrder;
    if (!payment || !order || payment.status !== PaymentStatus.SUBMITTED || order.status !== BookingOrderStatus.PROOF_SUBMITTED) {
      throw new Error("Only submitted consolidated payments can require customer action.");
    }
    assertBookingOrderTransition(order.status, BookingOrderStatus.ACTION_REQUIRED);
    const now = new Date();
    await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.ACTION_REQUIRED, actionRequiredAt: now, verifiedByUserId: input.adminUserId, reviewNote: input.reviewNote.trim() } });
    const updated = await tx.bookingOrder.update({ where: { id: order.id }, data: { status: BookingOrderStatus.ACTION_REQUIRED, version: { increment: 1 } } });
    await writeAuditLog(tx, { actorUserId: input.adminUserId, action: "booking_order.payment_action_required", entityType: "BookingOrder", entityId: order.id, metadata: { instructions: input.reviewNote.trim() } });
    await enqueueOrderNotification(tx, { dedupeKey: `${order.id}:payment-action-required:${now.getTime()}`, userId: order.userId, bookingOrderId: order.id, eventType: "BOOKING_ORDER_PAYMENT_ACTION_REQUIRED", payload: { subject: `Action required for ${order.reference}`, heading: "New payment proof is required", lines: [`Order reference: ${order.reference}`, input.reviewNote.trim(), "Open the order to submit a replacement proof."] } });
    return updated;
  });
}

export { orderScheduleLines };
