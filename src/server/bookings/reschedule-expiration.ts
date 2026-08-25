import { BookingRescheduleStatus, PaymentStatus, PriceAdjustmentStatus, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { enqueueRescheduleNotification } from "@/lib/notifications/rescheduling";

type ExpirationOptions = {
  now?: Date;
  batchSize?: number;
  replacementFacilityId?: string;
};

export async function expireStaleRescheduleHolds(
  tx: Prisma.TransactionClient,
  options: ExpirationOptions = {}
) {
  const now = options.now ?? new Date();
  const batchSize = Math.min(Math.max(options.batchSize ?? 100, 1), 500);
  const facilityFilter = options.replacementFacilityId
    ? Prisma.sql`AND "replacementFacilityId" = ${options.replacementFacilityId}`
    : Prisma.empty;
  const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "BookingReschedule"
    WHERE "status" = 'ADDITIONAL_PAYMENT_REQUIRED'::"BookingRescheduleStatus"
      AND "holdExpiresAt" <= ${now}
      ${facilityFilter}
    ORDER BY "holdExpiresAt" ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `);
  const ids = lockedRows.map((row) => row.id);

  if (ids.length === 0) {
    return { expiredCount: 0, expiredIds: [] as string[] };
  }

  const candidates = await tx.bookingReschedule.findMany({
    where: {
      id: { in: ids },
      status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
      additionalPayment: { status: PaymentStatus.AWAITING_PAYMENT }
    },
    include: { booking: { select: { userId: true } } }
  });
  const expirableIds = candidates.map((candidate) => candidate.id);

  if (expirableIds.length === 0) {
    return { expiredCount: 0, expiredIds: [] as string[] };
  }

  await tx.reschedulePayment.updateMany({
    where: {
      bookingRescheduleId: { in: expirableIds },
      status: PaymentStatus.AWAITING_PAYMENT
    },
    data: { status: PaymentStatus.EXPIRED }
  });
  await tx.bookingReschedule.updateMany({
    where: {
      id: { in: expirableIds },
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

  for (const candidate of candidates) {
    await writeAuditLog(tx, {
      actorUserId: null,
      action: "booking.reschedule.hold_expired",
      entityType: "BookingReschedule",
      entityId: candidate.id,
      metadata: { bookingId: candidate.bookingId }
    });
    await enqueueRescheduleNotification(tx, {
      dedupeKey: `${candidate.id}:hold-expired`,
      userId: candidate.booking.userId,
      bookingId: candidate.bookingId,
      rescheduleId: candidate.id,
      eventType: "RESCHEDULE_HOLD_EXPIRED",
      payload: {
        subject: `Replacement hold expired for ${candidate.originalBookingReference}`,
        heading: "Replacement-slot hold expired",
        lines: [
          `Booking reference: ${candidate.originalBookingReference}`,
          "The additional-payment deadline passed, so the replacement slot was released.",
          "Your original confirmed booking remains valid and unchanged."
        ]
      }
    });
  }

  return { expiredCount: expirableIds.length, expiredIds: expirableIds };
}

export async function expirePendingReschedules(options: ExpirationOptions = {}) {
  return prisma.$transaction((tx) => expireStaleRescheduleHolds(tx, options));
}
