import { BookingOrderStatus, BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { enqueueOrderNotification } from "@/lib/notifications/orders";
import { assertBookingOrderTransition } from "@/server/orders/policy";

export type ExpirePendingOrdersResult = {
  expiredOrderCount: number;
  expiredBookingCount: number;
  expiredPaymentCount: number;
};

export async function expireStaleOrdersInTransaction(
  tx: Prisma.TransactionClient,
  options: { now: Date; orderIds?: string[]; facilityIds?: string[] }
): Promise<ExpirePendingOrdersResult> {
  const orders = await tx.bookingOrder.findMany({
    where: {
      status: BookingOrderStatus.PENDING_PAYMENT,
      paymentDeadline: { lte: options.now },
      ...(options.orderIds ? { id: { in: options.orderIds } } : {}),
      ...(options.facilityIds ? { bookings: { some: { facilityId: { in: options.facilityIds }, status: BookingStatus.HELD } } } : {})
    },
    select: { id: true, userId: true, reference: true }
  });
  let expiredOrderCount = 0;
  let expiredBookingCount = 0;
  let expiredPaymentCount = 0;
  for (const order of orders) {
    assertBookingOrderTransition(BookingOrderStatus.PENDING_PAYMENT, BookingOrderStatus.EXPIRED);
    const claimed = await tx.bookingOrder.updateMany({ where: { id: order.id, status: BookingOrderStatus.PENDING_PAYMENT }, data: { status: BookingOrderStatus.EXPIRED, expiredAt: options.now, version: { increment: 1 } } });
    if (claimed.count !== 1) continue;
    const bookings = await tx.booking.updateMany({ where: { bookingOrderId: order.id, status: BookingStatus.HELD }, data: { status: BookingStatus.EXPIRED, paymentHoldExpiresAt: null, cancellationReason: "Consolidated payment deadline expired" } });
    const payments = await tx.payment.updateMany({ where: { bookingOrderId: order.id, status: PaymentStatus.AWAITING_PAYMENT }, data: { status: PaymentStatus.EXPIRED } });
    await writeAuditLog(tx, { actorUserId: null, action: "booking_order.expired", entityType: "BookingOrder", entityId: order.id, after: { status: BookingOrderStatus.EXPIRED, expiredAt: options.now.toISOString() } });
    await enqueueOrderNotification(tx, { dedupeKey: `${order.id}:expired`, userId: order.userId, bookingOrderId: order.id, eventType: "BOOKING_ORDER_EXPIRED", payload: { subject: `Booking order ${order.reference} expired`, heading: "Your temporary booking holds expired", lines: [`Order reference: ${order.reference}`, "Payment proof was not submitted before the deadline, so all schedules in this order are available to book again."] } });
    expiredOrderCount += 1;
    expiredBookingCount += bookings.count;
    expiredPaymentCount += payments.count;
  }
  return { expiredOrderCount, expiredBookingCount, expiredPaymentCount };
}

export async function expirePendingOrders(options: { now?: Date; batchSize?: number } = {}): Promise<ExpirePendingOrdersResult> {
  const now = options.now ?? new Date();
  const batchSize = Math.min(Math.max(options.batchSize ?? 50, 1), 200);

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BookingOrder"
      WHERE "status" = 'PENDING_PAYMENT'
        AND "paymentDeadline" <= ${now}
      ORDER BY "paymentDeadline" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `);
    const orderIds = candidates.map((candidate) => candidate.id);
    if (orderIds.length === 0) return { expiredOrderCount: 0, expiredBookingCount: 0, expiredPaymentCount: 0 };

    return expireStaleOrdersInTransaction(tx, { now, orderIds });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}
