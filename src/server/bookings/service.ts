import crypto from "node:crypto";

import { BookingRescheduleStatus, BookingStatus, PaymentProvider, PaymentStatus, Prisma, PricingDayType, type Facility, type PricingRule } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getPaymentMode, isProductionMockPaymentAllowed, isStrictProductionEnvironment } from "@/lib/config/env";
import { buildLocalDayUtcRange, buildUtcDateFromLocalMinutes, getDayOfWeek, getLocalMinutesForDate } from "@/lib/time/slots";
import { isDateWithinBookingWindow } from "@/server/bookings/booking-window";
import { expireStaleRescheduleHolds } from "@/server/bookings/reschedule-expiration";
import { buildDaySlots, canFitDuration, rangesOverlapByMinute, rangesOverlap, type DaySlot, type MinuteInterval } from "@/server/bookings/core";
import { canCustomerCancelBooking, resolveCancellationEnabled, resolveCancellationWindowHours } from "@/server/bookings/policies";
import { calculatePrice } from "@/server/pricing/engine";

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
  paymentMethod?: "cash" | "manual_gcash" | "manual_bank_transfer" | "walk_in";
  paymentReference?: string;
};

export const BOOKING_INCREMENT_MINUTES = 60;

export function assertAllowedBookingDuration(durationMinutes: number, pricingMinimumMinutes: number, slotIntervalMinutes: number) {
  const minimumMinutes = Math.max(pricingMinimumMinutes, BOOKING_INCREMENT_MINUTES);

  if (
    durationMinutes < minimumMinutes ||
    durationMinutes % BOOKING_INCREMENT_MINUTES !== 0 ||
    durationMinutes % slotIntervalMinutes !== 0
  ) {
    throw new Error("Bookings must be at least 1 hour and use hourly increments.");
  }
}

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

export function activeBookingWhere(now: Date): Prisma.BookingWhereInput {
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
                in: [
                  PaymentStatus.SUBMITTED,
                  PaymentStatus.ACTION_REQUIRED,
                  PaymentStatus.VERIFIED,
                  PaymentStatus.PAID,
                  PaymentStatus.PENDING
                ]
              }
            }
          }
        ]
      },
      {
        status: BookingStatus.PENDING_PAYMENT,
        OR: [
          { paymentHoldExpiresAt: { gt: now } },
          { payment: { status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.ACTION_REQUIRED, PaymentStatus.VERIFIED, PaymentStatus.PAID, PaymentStatus.PENDING] } } }
        ]
      }
    ]
  };
}

function findActiveReplacementHolds(
  tx: Prisma.TransactionClient,
  input: { facilityId: string; startAtUtc: Date; endAtUtc: Date; now: Date }
) {
  return tx.bookingReschedule.findMany({
    where: {
      replacementFacilityId: input.facilityId,
      OR: [
        { status: BookingRescheduleStatus.PAYMENT_SUBMITTED },
        {
          status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
          holdExpiresAt: { gt: input.now }
        }
      ],
      replacementStartAtUtc: { lt: input.endAtUtc },
      replacementEndAtUtc: { gt: input.startAtUtc }
    },
    select: {
      replacementStartAtUtc: true,
      replacementEndAtUtc: true
    }
  });
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

function getDefaultPricingRule(rules: PricingRule[]) {
  const defaultRule = rules.find((rule) => rule.isActive && rule.dayType === PricingDayType.DEFAULT);
  if (!defaultRule) {
    throw new Error("Facility default pricing is not configured.");
  }
  return defaultRule;
}

export async function calculateAuthoritativePrice(params: {
  tx: Prisma.TransactionClient;
  facilityId: string;
  timezone: string;
  slotIntervalMinutes: number;
  dateKey: string;
  startMinutes: number;
  durationMinutes: number;
  rules: PricingRule[];
  calculatedAt: Date;
}) {
  const holidayDate = new Date(`${params.dateKey}T00:00:00.000Z`);
  const holidays = await params.tx.holiday.findMany({
    where: {
      date: holidayDate,
      isActive: true,
      OR: [{ facilityId: null }, { facilityId: params.facilityId }]
    }
  });

  return calculatePrice({
    facilityId: params.facilityId,
    timezone: params.timezone,
    dateKey: params.dateKey,
    startMinutes: params.startMinutes,
    durationMinutes: params.durationMinutes,
    intervalMinutes: params.slotIntervalMinutes,
    rules: params.rules,
    holidays,
    calculatedAt: params.calculatedAt
  });
}

export function getDailyOpeningRange(facility: Pick<Facility, "slotIntervalMinutes" | "timezone"> & {
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
}, dateKey: string, options: { excludeBookingId?: string } = {}): Promise<FacilityDayAvailability> {
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
  const calendarDay = buildLocalDayUtcRange(dateKey, facility.timezone);
  const now = new Date();

  const [bookings, replacementHolds, blockedSchedules] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...(options.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
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
    prisma.bookingReschedule.findMany({
      where: {
        ...(options.excludeBookingId ? { bookingId: { not: options.excludeBookingId } } : {}),
        replacementFacilityId: facility.id,
        OR: [
          { status: BookingRescheduleStatus.PAYMENT_SUBMITTED },
          { status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED, holdExpiresAt: { gt: now } }
        ],
        replacementStartAtUtc: { lt: dayEndUtc },
        replacementEndAtUtc: { gt: dayStartUtc }
      },
      select: {
        replacementStartAtUtc: true,
        replacementEndAtUtc: true
      }
    }),
    prisma.blockedSchedule.findMany({
      where: {
        facilityId: facility.id,
        startAtUtc: {
          lt: calendarDay.endUtc
        },
        endAtUtc: {
          gt: calendarDay.startUtc
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
    ...replacementHolds.map((hold) => ({
      startMinutes: getLocalMinutesForDate(hold.replacementStartAtUtc, dateKey, facility.timezone),
      endMinutes: getLocalMinutesForDate(hold.replacementEndAtUtc, dateKey, facility.timezone),
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
      await expireStaleRescheduleHolds(tx, {
        now,
        replacementFacilityId: input.facilityId
      });
      await assertBookingUserExists(tx, input.userId);

      const [facility, holdSetting] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
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

      const defaultPricingRule = getDefaultPricingRule(facility.pricingRules);
      assertAllowedBookingDuration(input.durationMinutes, defaultPricingRule.minimumMinutes, facility.slotIntervalMinutes);

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

      const [conflictingBookings, replacementHolds, blockedSchedules] = await Promise.all([
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
        findActiveReplacementHolds(tx, {
          facilityId: facility.id,
          startAtUtc,
          endAtUtc,
          now
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
        ...replacementHolds.map((hold) => ({
          startMinutes: getLocalMinutesForDate(hold.replacementStartAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(hold.replacementEndAtUtc, input.dateKey, facility.timezone),
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
      const price = await calculateAuthoritativePrice({
        tx,
        facilityId: facility.id,
        timezone: facility.timezone,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        dateKey: input.dateKey,
        startMinutes: input.startMinutes,
        durationMinutes: input.durationMinutes,
        rules: facility.pricingRules,
        calculatedAt: now
      });
      const amountMinor = price.amountMinor;
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
          currency: price.currency,
          priceSnapshot: price as unknown as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          paymentHoldExpiresAt,
          payment: {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: createBookingReference(),
              method: "manual_gcash",
              status: PaymentStatus.AWAITING_PAYMENT,
              amountMinor,
              currency: price.currency,
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
        await expireStaleRescheduleHolds(tx, {
          now,
          replacementFacilityId: input.facilityId
        });
        await assertBookingUserExists(tx, input.userId);

      const [facility, mockSetting] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
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

      const defaultPricingRule = getDefaultPricingRule(facility.pricingRules);
      assertAllowedBookingDuration(input.durationMinutes, defaultPricingRule.minimumMinutes, facility.slotIntervalMinutes);

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

      const [conflictingBookings, replacementHolds, blockedSchedules] = await Promise.all([
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
        findActiveReplacementHolds(tx, {
          facilityId: facility.id,
          startAtUtc,
          endAtUtc,
          now
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
        ...replacementHolds.map((hold) => ({
          startMinutes: getLocalMinutesForDate(hold.replacementStartAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(hold.replacementEndAtUtc, input.dateKey, facility.timezone),
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

      const price = await calculateAuthoritativePrice({
        tx,
        facilityId: facility.id,
        timezone: facility.timezone,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        dateKey: input.dateKey,
        startMinutes: input.startMinutes,
        durationMinutes: input.durationMinutes,
        rules: facility.pricingRules,
        calculatedAt: now
      });
      const amountMinor = price.amountMinor;

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
          currency: price.currency,
          priceSnapshot: price as unknown as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          paymentHoldExpiresAt: null,
          payment: {
            create: {
              provider: PaymentProvider.MOCK,
              providerReference: `mock_${input.idempotencyKey ?? crypto.randomUUID()}`,
              status: PaymentStatus.PAID,
              amountMinor,
              currency: price.currency,
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
      await expireStaleAwaitingPaymentHolds(tx, now);
      await expireStaleRescheduleHolds(tx, {
        now,
        replacementFacilityId: input.facilityId
      });

      const [facility] = await Promise.all([
        tx.facility.findUnique({
          where: { id: input.facilityId },
          include: {
            operatingHours: true,
            pricingRules: {
              where: { isActive: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        })
      ]);

      if (!facility || !facility.isEnabled) {
        throw new Error("Facility is not available.");
      }

      const defaultPricingRule = getDefaultPricingRule(facility.pricingRules);
      assertAllowedBookingDuration(input.durationMinutes, defaultPricingRule.minimumMinutes, facility.slotIntervalMinutes);

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

      const [conflictingBookings, replacementHolds, blockedSchedules] = await Promise.all([
        tx.booking.findMany({
          where: {
            facilityId: facility.id,
            ...activeBookingWhere(now),
            startAtUtc: { lt: endAtUtc },
            endAtUtc: { gt: startAtUtc }
          },
          select: { startAtUtc: true, endAtUtc: true }
        }),
        findActiveReplacementHolds(tx, {
          facilityId: facility.id,
          startAtUtc,
          endAtUtc,
          now
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
        ...replacementHolds.map((hold) => ({
          startMinutes: getLocalMinutesForDate(hold.replacementStartAtUtc, input.dateKey, facility.timezone),
          endMinutes: getLocalMinutesForDate(hold.replacementEndAtUtc, input.dateKey, facility.timezone),
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

      const price = await calculateAuthoritativePrice({
        tx,
        facilityId: facility.id,
        timezone: facility.timezone,
        slotIntervalMinutes: facility.slotIntervalMinutes,
        dateKey: input.dateKey,
        startMinutes: input.startMinutes,
        durationMinutes: input.durationMinutes,
        rules: facility.pricingRules,
        calculatedAt: now
      });
      const amountMinor = price.amountMinor;

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
          currency: price.currency,
          priceSnapshot: price as unknown as Prisma.InputJsonValue,
          paymentHoldExpiresAt: null,
          payment: {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: createBookingReference(),
              method: input.paymentMethod ?? "walk_in",
              externalReference: input.paymentReference?.trim() || null,
              status: PaymentStatus.VERIFIED,
              amountMinor,
              amountPaidMinor: amountMinor,
              currency: price.currency,
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
    await expireStaleRescheduleHolds(tx, { now });
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
          },
          reschedules: {
            where: {
              status: {
                in: [
                  BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
                  BookingRescheduleStatus.PAYMENT_SUBMITTED
                ]
              }
            },
            select: { id: true }
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
    if (booking.reschedules.length > 0) {
      throw new Error("This booking cannot be cancelled while a rescheduling request is active.");
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
