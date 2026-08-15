import { BookingStatus, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ExpirePendingBookingsResult = {
  expiredBookingCount: number;
  expiredPaymentCount: number;
  expiredBookingIds: string[];
};

type ExpirePendingBookingsOptions = {
  now?: Date;
  batchSize?: number;
};

export async function expirePendingBookings(options: ExpirePendingBookingsOptions = {}): Promise<ExpirePendingBookingsResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 100;

  return prisma.$transaction(async (tx) => {
    const expiredCandidates = await tx.booking.findMany({
      where: {
        status: BookingStatus.HELD,
        paymentHoldExpiresAt: { lte: now },
        payment: {
          status: PaymentStatus.AWAITING_PAYMENT
        }
      },
      orderBy: { paymentHoldExpiresAt: "asc" },
      take: batchSize,
      select: { id: true }
    });
    const candidateIds = expiredCandidates.map((booking) => booking.id);

    if (candidateIds.length === 0) {
      return {
        expiredBookingCount: 0,
        expiredPaymentCount: 0,
        expiredBookingIds: []
      };
    }

    await tx.booking.updateMany({
      where: {
        id: { in: candidateIds },
        status: BookingStatus.HELD,
        paymentHoldExpiresAt: { lte: now }
      },
      data: {
        status: BookingStatus.EXPIRED
      }
    });

    const expiredBookings = await tx.booking.findMany({
      where: {
        id: { in: candidateIds },
        status: BookingStatus.EXPIRED
      },
      select: { id: true }
    });
    const expiredBookingIds = expiredBookings.map((booking) => booking.id);

    if (expiredBookingIds.length === 0) {
      return {
        expiredBookingCount: 0,
        expiredPaymentCount: 0,
        expiredBookingIds: []
      };
    }

    const expiredPayments = await tx.payment.updateMany({
      where: {
        bookingId: { in: expiredBookingIds },
        status: PaymentStatus.AWAITING_PAYMENT
      },
      data: {
        status: PaymentStatus.EXPIRED
      }
    });

    return {
      expiredBookingCount: expiredBookingIds.length,
      expiredPaymentCount: expiredPayments.count,
      expiredBookingIds
    };
  });
}
