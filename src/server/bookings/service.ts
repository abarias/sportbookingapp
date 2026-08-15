import crypto from "node:crypto";

import { BookingStatus, PaymentProvider, PaymentStatus, Prisma, PricingBillingMode, type Facility } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getPaymentMode, isProductionMockPaymentAllowed, isStrictProductionEnvironment } from "@/lib/config/env";
import { buildUtcDateFromLocalMinutes, getDayOfWeek, getLocalMinutesForDate } from "@/lib/time/slots";
import { isDateWithinBookingWindow } from "@/server/bookings/booking-window";
import { buildDaySlots, canFitDuration, rangesOverlapByMinute, rangesOverlap, type DaySlot, type MinuteInterval } from "@/server/bookings/core";
import { canCustomerCancelBooking, resolveCancellationEnabled, resolveCancellationWindowHours } from "@/server/bookings/policies";

export type FacilityDayAvailability = {
  dateKey: string;
  timezone: string;
  slotIntervalMinutes: number;
  openingRange: MinuteInterval | null;
  slots: DaySlot[];
};

type BookingCreationInput = {
  userId: string;
  facilityId: string;
  dateKey: string;
  startMinutes: number;
  durationMinutes: number;
  idempotencyKey?: string;
};

function getPaymentHoldMinutes(value: Prisma.JsonValue | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return Number.parseInt(process.env.PAYMENT_HOLD_MINUTES ?? "15", 10);
}

function assertMockPaymentModeAllowed() {
  if (getPaymentMode() !== "mock") {
    throw new Error("Mock payment mode is disabled.");
  }

  if (isStrictProductionEnvironment() && !isProductionMockPaymentAllowed()) {
    throw new Error("Mock payment mode is not allowed in production.");
  }
}

function activeBookingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: BookingStatus.CONFIRMED },
      {
        status: BookingStatus.HELD,
        OR: [
          {
            paymentHoldExpiresAt: { gt: now },
            payment: { status: PaymentStatus.AWAITING_PAYMENT }
          },
          {
            payment: {
              status: {
                in: [PaymentStatus.SUBMITTED, PaymentStatus.ACTION_REQUIRED]
              }
            }
          }
        ]
      },
      {
        status: BookingStatus.PENDING_PAYMENT,
        paymentHoldExpiresAt: { gt: now }
      }
    ]
  };
}

function createBookingReference() {
  return `PG-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function expireStaleAwaitingPaymentHolds(tx: Prisma.TransactionClient, now: Date) {
  const expiredBookings = await tx.booking.findMany({
    where: {
      status: BookingStatus.HELD,
      paymentHoldExpiresAt: { lte: now },
      payment: { status: PaymentStatus.AWAITING_PAYMENT }
    },
    select: { id: true }
  });
  const expiredIds = expiredBookings.map((booking) => booking.id);

  if (expiredIds.length === 0) {
    return;
  }

  await tx.booking.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: BookingStatus.EXPIRED }
  });

  await tx.payment.updateMany({
    where: {
      bookingId: { in: expiredIds },
      status: PaymentStatus.AWAITING_PAYMENT
    },
    data: { status: PaymentStatus.EXPIRED }
  });
}

async function assertBookingUserExists(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!user) {
    throw new Error("Your session no longer matches the active database. Please sign out and sign in again.");
  }
}

async function findReusableBooking(
  tx: Prisma.TransactionClient,
  input: BookingCreationInput,
  includePayment = false
) {
  if (!input.idempotencyKey) {
    return null;
  }

  const existingBooking = await tx.booking.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: includePayment ? { payment: true } : undefined
  });

  if (!existingBooking) {
    return null;
  }

  if (existingBooking.userId !== input.userId) {
    throw new Error("Booking request could not be reused.");
  }

  return existingBooking;
}

function getBookingAmount(amountMinor: number, billingMode: PricingBillingMode, durationMinutes: number) {
  if (billingMode === PricingBillingMode.PER_BLOCK) {
    return amountMinor;
  }

  return Math.round((amountMinor * durationMinutes) / 60);
}

function getDailyOpeningRange(facility: Pick<Facility, "slotIntervalMinutes" | "timezone"> & {
  operatingHours: Array<{
    dayOfWeek: number;
    opensAtMinutes: number;
    closesAtMinutes: number;
    isClosed: boolean;
  }>;
}, dateKey: string) {
  const dayOfWeek = getDayOfWeek(dateKey, facility.timezone);
  const operatingHours = facility.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);

  if (!operatingHours || operatingHours.isClosed) {
    return null;
  }

  return {
    startMinutes: operatingHours.opensAtMinutes,
    endMinutes: operatingHours.closesAtMinutes
  };
}

export async function getFacilityDayAvailability(facility: Pick<Facility, "id" | "timezone" | "slotIntervalMinutes"> & {
  operatingHours: Array<{
    dayOfWeek: number;
    opensAtMinutes: number;
    closesAtMinutes: number;
    isClosed: boolean;
  }>;
}, dateKey: string): Promise<FacilityDayAvailability> {
  const openingRange = getDailyOpeningRange(facility, dateKey);

  if (!openingRange) {
    return {
      dateKey,
      timezone: facility.timezone,
      slotIntervalMinutes: facility.slotIntervalMinutes,
      openingRange: null,
      slots: []
    };
  }

  const dayStartUtc = buildUtcDateFromLocalMinutes(dateKey, openingRange.startMinutes, facility.timezone);
  const dayEndUtc = buildUtcDateFromLocalMinutes(dateKey, openingRange.endMinutes, facility.timezone);
  const now = new Date();

  const [bookings, blockedSchedules] = await Promise.all([
    prisma.booking.findMany({
      where: {
        facilityId: facility.id,
        ...activeBookingWhere(now),
        startAtUtc: {
          lt: dayEndUtc
        },
        endAtUtc: {
          gt: dayStartUtc
        }
      },
      select: {
        startAtUtc: true,
        endAtUtc: true
      }
    }),
    prisma.blockedSchedule.findMany({
      where: {
        facilityId: facility.id,
        startAtUtc: {
          lt: dayEndUtc
        },
        endAtUtc: {
          gt: dayStartUtc
        }
      },
      select: {
        startAtUtc: true,
        endAtUtc: true
      }
    })
  ]);

  const busyIntervals = [
    ...bookings.map((booking) => ({
      startMinutes: getLocalMinutesForDate(booking.startAtUtc, dateKey, facility.timezone),
      endMinutes: getLocalMinutesForDate(booking.endAtUtc, dateKey, facility.timezone),
      reason: "BOOKED" as const
    })),
    ...blockedSchedules.map((block) => ({
      startMinutes: getLocalMinutesForDate(block.startAtUtc, dateKey, facility.timezone),
      endMinutes: getLocalMinutesForDate(block.endAtUtc, dateKey, facility.timezone),
      reason: "BLOCKED" as const
    }))
  ].filter((interval) => interval.endMinutes > openingRange.startMinutes && interval.startMinutes < openingRange.endMinutes);

  const slots = buildDaySlots({
    openingRange,
    slotIntervalMinutes: facility.slotIntervalMinutes,
    busyIntervals
  }).map((slot) => {
    const slotStartUtc = buildUtcDateFromLocalMinutes(dateKey, slot.startMinutes, facility.timezone);

    if (slotStartUtc <= now) {
      return {
        ...slot,
        isAvailable: false,
        reason: slot.reason === "AVAILABLE" ? "BLOCKED" : slot.reason
      };
    }

    return slot;
  });

  return {
    dateKey,
    timezone: facility.timezone,
    slotIntervalMinutes: facility.slotIntervalMinutes,
    openingRange,
    slots
  };
}

export async function createBookingHold(input: BookingCreationInput) {
  const now = new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
      const existingBooking = await findReusableBooking(tx, input);

      if (existingBooking) {
        return existingBooking;
      }

      await expireStaleAwaitingPaymentHolds(tx, now);
      await assertBookingUserExists(tx, input.userId);

      const [facility, holdSetting] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }),
        tx.appSetting.findUnique({
          where: { key: "booking.paymentHoldMinutes" }
        })
      ]);

      if (!facility || !facility.isEnabled) {
        throw new Error("Facility is not available.");
      }

      await expireStaleAwaitingPaymentHolds(tx, now);

      const pricingRule = facility.pricingRules[0];

      if (!pricingRule) {
        throw new Error("Facility pricing is not configured.");
      }

      if (input.durationMinutes < pricingRule.minimumMinutes || input.durationMinutes % facility.slotIntervalMinutes !== 0) {
        throw new Error("Duration is not allowed for this facility.");
      }

      const openingRange = getDailyOpeningRange(facility, input.dateKey);

      if (!openingRange) {
        throw new Error("Facility is closed on the selected date.");
      }

      if (!isDateWithinBookingWindow(input.dateKey, facility.timezone, now)) {
        throw new Error("Bookings are only available within the current booking window.");
      }

      const bookingRange = {
        startMinutes: input.startMinutes,
        endMinutes: input.startMinutes + input.durationMinutes
      };

      if (!rangesOverlapByMinute(bookingRange, openingRange) || bookingRange.endMinutes > openingRange.endMinutes) {
        throw new Error("Selected time is outside operating hours.");
      }

      const startAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes, facility.timezone);
      const endAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes + input.durationMinutes, facility.timezone);

      if (startAtUtc <= now) {
        throw new Error("You can only book future time slots.");
      }

      const [conflictingBookings, blockedSchedules] = await Promise.all([
        tx.booking.findMany({
          where: {
            facilityId: facility.id,
            ...activeBookingWhere(now),
            startAtUtc: {
              lt: endAtUtc
            },
            endAtUtc: {
              gt: startAtUtc
            }
          },
          select: { startAtUtc: true, endAtUtc: true }
        }),
        tx.blockedSchedule.findMany({
          where: {
            facilityId: facility.id,
            startAtUtc: {
              lt: endAtUtc
            },
            endAtUtc: {
              gt: startAtUtc
            }
          },
          select: { startAtUtc: true, endAtUtc: true }
        })
      ]);

      const busyIntervals = [
        ...conflictingBookings.map((booking) => ({
          startMinutes: getLocalMinutesForDate(booking.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(booking.endAtUtc, input.dateKey, facility.timezone),
          reason: "BOOKED" as const
        })),
        ...blockedSchedules.map((block) => ({
          startMinutes: getLocalMinutesForDate(block.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(block.endAtUtc, input.dateKey, facility.timezone),
          reason: "BLOCKED" as const
        }))
      ];

      const slots = buildDaySlots({
        openingRange,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        busyIntervals
      });

      if (!canFitDuration(slots, input.startMinutes, input.durationMinutes, facility.slotIntervalMinutes)) {
        throw new Error("Selected time is no longer available.");
      }

      const paymentHoldMinutes = getPaymentHoldMinutes(holdSetting?.value);
      const amountMinor = getBookingAmount(pricingRule.amountMinor, pricingRule.billingMode, input.durationMinutes);
      const paymentHoldExpiresAt = new Date(now.getTime() + paymentHoldMinutes * 60_000);

      return tx.booking.create({
        data: {
          userId: input.userId,
          facilityId: facility.id,
          status: BookingStatus.HELD,
          startAtUtc,
          endAtUtc,
          timezone: facility.timezone,
          slotCount: input.durationMinutes / facility.slotIntervalMinutes,
          amountMinor,
          currency: pricingRule.currency,
          idempotencyKey: input.idempotencyKey,
          paymentHoldExpiresAt,
          payment: {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: createBookingReference(),
              method: "manual_gcash",
              status: PaymentStatus.AWAITING_PAYMENT,
              amountMinor,
              currency: pricingRule.currency,
              expiresAt: paymentHoldExpiresAt
            }
          }
        },
        include: {
          payment: true
        }
      });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingBooking = await prisma.booking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: true }
      });

      if (existingBooking?.userId === input.userId) {
        return existingBooking;
      }
    }

    throw error;
  }
}

export async function createConfirmedBookingWithMockPayment(input: BookingCreationInput) {
  assertMockPaymentModeAllowed();

  const now = new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existingBooking = await findReusableBooking(tx, input, true);

        if (existingBooking) {
          return existingBooking;
        }

        await expireStaleAwaitingPaymentHolds(tx, now);
        await assertBookingUserExists(tx, input.userId);

      const [facility, mockSetting] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }),
        tx.appSetting.findUnique({
          where: { key: "payments.mockAutoConfirmEnabled" }
        })
      ]);

      if (mockSetting?.value === false) {
        throw new Error("Mock payment mode is disabled.");
      }

      if (!facility || !facility.isEnabled) {
        throw new Error("Facility is not available.");
      }

      await expireStaleAwaitingPaymentHolds(tx, now);
      await assertBookingUserExists(tx, input.userId);

      const pricingRule = facility.pricingRules[0];

      if (!pricingRule) {
        throw new Error("Facility pricing is not configured.");
      }

      if (input.durationMinutes < pricingRule.minimumMinutes || input.durationMinutes % facility.slotIntervalMinutes !== 0) {
        throw new Error("Duration is not allowed for this facility.");
      }

      const openingRange = getDailyOpeningRange(facility, input.dateKey);

      if (!openingRange) {
        throw new Error("Facility is closed on the selected date.");
      }

      if (!isDateWithinBookingWindow(input.dateKey, facility.timezone, now)) {
        throw new Error("Bookings are only available within the current booking window.");
      }

      const bookingRange = {
        startMinutes: input.startMinutes,
        endMinutes: input.startMinutes + input.durationMinutes
      };

      if (!rangesOverlapByMinute(bookingRange, openingRange) || bookingRange.endMinutes > openingRange.endMinutes) {
        throw new Error("Selected time is outside operating hours.");
      }

      const startAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes, facility.timezone);
      const endAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes + input.durationMinutes, facility.timezone);

      if (startAtUtc <= now) {
        throw new Error("You can only book future time slots.");
      }

      const [conflictingBookings, blockedSchedules] = await Promise.all([
        tx.booking.findMany({
          where: {
            facilityId: facility.id,
            ...activeBookingWhere(now),
            startAtUtc: {
              lt: endAtUtc
            },
            endAtUtc: {
              gt: startAtUtc
            }
          },
          select: { startAtUtc: true, endAtUtc: true }
        }),
        tx.blockedSchedule.findMany({
          where: {
            facilityId: facility.id,
            startAtUtc: {
              lt: endAtUtc
            },
            endAtUtc: {
              gt: startAtUtc
            }
          },
          select: { startAtUtc: true, endAtUtc: true }
        })
      ]);

      const busyIntervals = [
        ...conflictingBookings.map((booking) => ({
          startMinutes: getLocalMinutesForDate(booking.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(booking.endAtUtc, input.dateKey, facility.timezone),
          reason: "BOOKED" as const
        })),
        ...blockedSchedules.map((block) => ({
          startMinutes: getLocalMinutesForDate(block.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(block.endAtUtc, input.dateKey, facility.timezone),
          reason: "BLOCKED" as const
        }))
      ];

      const slots = buildDaySlots({
        openingRange,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        busyIntervals
      });

      if (!canFitDuration(slots, input.startMinutes, input.durationMinutes, facility.slotIntervalMinutes)) {
        throw new Error("Selected time is no longer available.");
      }

      const amountMinor = getBookingAmount(pricingRule.amountMinor, pricingRule.billingMode, input.durationMinutes);

      return tx.booking.create({
        data: {
          userId: input.userId,
          facilityId: facility.id,
          status: BookingStatus.CONFIRMED,
          startAtUtc,
          endAtUtc,
          timezone: facility.timezone,
          slotCount: input.durationMinutes / facility.slotIntervalMinutes,
          amountMinor,
          currency: pricingRule.currency,
          idempotencyKey: input.idempotencyKey,
          paymentHoldExpiresAt: null,
          payment: {
            create: {
              provider: PaymentProvider.MOCK,
              providerReference: `mock_${input.idempotencyKey ?? crypto.randomUUID()}`,
              status: PaymentStatus.PAID,
              amountMinor,
              currency: pricingRule.currency,
              paidAt: now
            }
          }
        },
        include: {
          payment: true
        }
      });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingBooking = await prisma.booking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: true }
      });

      if (existingBooking?.userId === input.userId) {
        return existingBooking;
      }
    }

    throw error;
  }
}

export async function createAdminConfirmedBooking(input: BookingCreationInput) {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const [facility] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        })
      ]);

      if (!facility || !facility.isEnabled) {
        throw new Error("Facility is not available.");
      }

      const pricingRule = facility.pricingRules[0];

      if (!pricingRule) {
        throw new Error("Facility pricing is not configured.");
      }

      if (input.durationMinutes < pricingRule.minimumMinutes || input.durationMinutes % facility.slotIntervalMinutes !== 0) {
        throw new Error("Duration is not allowed for this facility.");
      }

      const openingRange = getDailyOpeningRange(facility, input.dateKey);

      if (!openingRange) {
        throw new Error("Facility is closed on the selected date.");
      }

      if (!isDateWithinBookingWindow(input.dateKey, facility.timezone, now)) {
        throw new Error("Bookings are only available within the current booking window.");
      }

      const bookingRange = {
        startMinutes: input.startMinutes,
        endMinutes: input.startMinutes + input.durationMinutes
      };

      if (!rangesOverlapByMinute(bookingRange, openingRange) || bookingRange.endMinutes > openingRange.endMinutes) {
        throw new Error("Selected time is outside operating hours.");
      }

      const startAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes, facility.timezone);
      const endAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes + input.durationMinutes, facility.timezone);

      if (startAtUtc <= now) {
        throw new Error("You can only book future time slots.");
      }

      const [conflictingBookings, blockedSchedules] = await Promise.all([
        tx.booking.findMany({
          where: {
            facilityId: facility.id,
            ...activeBookingWhere(now),
            startAtUtc: { lt: endAtUtc },
            endAtUtc: { gt: startAtUtc }
          },
          select: { startAtUtc: true, endAtUtc: true }
        }),
        tx.blockedSchedule.findMany({
          where: {
            facilityId: facility.id,
            startAtUtc: { lt: endAtUtc },
            endAtUtc: { gt: startAtUtc }
          },
          select: { startAtUtc: true, endAtUtc: true }
        })
      ]);

      const busyIntervals = [
        ...conflictingBookings.map((booking) => ({
          startMinutes: getLocalMinutesForDate(booking.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(booking.endAtUtc, input.dateKey, facility.timezone),
          reason: "BOOKED" as const
        })),
        ...blockedSchedules.map((block) => ({
          startMinutes: getLocalMinutesForDate(block.startAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(block.endAtUtc, input.dateKey, facility.timezone),
          reason: "BLOCKED" as const
        }))
      ];

      const slots = buildDaySlots({
        openingRange,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        busyIntervals
      });

      if (!canFitDuration(slots, input.startMinutes, input.durationMinutes, facility.slotIntervalMinutes)) {
        throw new Error("Selected time is no longer available.");
      }

      const amountMinor = getBookingAmount(pricingRule.amountMinor, pricingRule.billingMode, input.durationMinutes);

      return tx.booking.create({
        data: {
          userId: input.userId,
          facilityId: facility.id,
          status: BookingStatus.CONFIRMED,
          startAtUtc,
          endAtUtc,
          timezone: facility.timezone,
          slotCount: input.durationMinutes / facility.slotIntervalMinutes,
          amountMinor,
          currency: pricingRule.currency,
          paymentHoldExpiresAt: null,
          payment: {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: createBookingReference(),
              method: "walk_in",
              status: PaymentStatus.VERIFIED,
              amountMinor,
              amountPaidMinor: amountMinor,
              currency: pricingRule.currency,
              paidAt: now,
              submittedAt: now,
              verifiedAt: now
            }
          }
        },
        include: {
          payment: true
        }
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}

export async function cancelBookingByCustomer(input: { bookingId: string; userId: string }) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const [booking, cancellationSetting, cancellationWindowSetting] = await Promise.all([
      tx.booking.findFirst({
        where: {
          id: input.bookingId,
          userId: input.userId
        },
        include: {
          facility: {
            select: {
              name: true,
              cancellationEnabledOverride: true,
              cancellationWindowHoursOverride: true
            }
          }
        }
      }),
      tx.appSetting.findUnique({
        where: { key: "booking.cancellationEnabled" }
      }),
      tx.appSetting.findUnique({
        where: { key: "booking.cancellationWindowHours" }
      })
    ]);

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const cancellationEnabled = resolveCancellationEnabled(
      cancellationSetting?.value === true,
      booking.facility.cancellationEnabledOverride
    );
    const globalCancellationWindowHours = typeof cancellationWindowSetting?.value === "number" ? cancellationWindowSetting.value : 24;
    const cancellationWindowHours = resolveCancellationWindowHours(
      globalCancellationWindowHours,
      booking.facility.cancellationWindowHoursOverride
    );

    if (
      !canCustomerCancelBooking({
        bookingStatus: booking.status,
        startAtUtc: booking.startAtUtc,
        createdAt: booking.createdAt,
        now,
        cancellationEnabled,
        cancellationWindowHours
      })
    ) {
      throw new Error("This booking can no longer be cancelled.");
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: now,
        cancellationReason: "Cancelled by customer"
      }
    });
  });
}

export function rangesOverlapUtc(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return rangesOverlap(aStart, aEnd, bStart, bEnd);
}
