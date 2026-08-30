import { BookingRescheduleStatus, Prisma, PricingDayType, type PricingRule } from "@prisma/client";

import { buildUtcDateFromLocalMinutes } from "@/lib/time/slots";
import { isDateWithinBookingWindow } from "@/server/bookings/booking-window";
import { rangesOverlapByMinute } from "@/server/bookings/core";
import {
  activeBookingWhere,
  assertAllowedBookingDuration,
  calculateAuthoritativePrice,
  getDailyOpeningRange
} from "@/server/bookings/service";

export type BookingSelectionInput = {
  facilityId: string;
  dateKey: string;
  startMinutes: number;
  durationMinutes: number;
};

function getDefaultPricingRule(rules: PricingRule[]) {
  const rule = rules.find((item) => item.isActive && item.dayType === PricingDayType.DEFAULT);
  if (!rule) throw new Error("Facility default pricing is not configured.");
  return rule;
}

export async function validateAndPriceBookingSelection(
  tx: Prisma.TransactionClient,
  input: BookingSelectionInput,
  now: Date
) {
  const facility = await tx.facility.findUnique({
    where: { id: input.facilityId },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      operatingHours: true,
      pricingRules: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!facility?.isEnabled) throw new Error("Facility is not available.");

  const defaultRule = getDefaultPricingRule(facility.pricingRules);
  assertAllowedBookingDuration(input.durationMinutes, defaultRule.minimumMinutes, facility.slotIntervalMinutes);

  if (input.startMinutes < 0 || input.startMinutes % facility.slotIntervalMinutes !== 0) {
    throw new Error("Selected time does not align with the facility schedule.");
  }

  if (!isDateWithinBookingWindow(input.dateKey, facility.timezone, now)) {
    throw new Error("Bookings are only available within the current booking window.");
  }

  const openingRange = getDailyOpeningRange(facility, input.dateKey);
  if (!openingRange) throw new Error("Facility is closed on the selected date.");

  const selectedRange = {
    startMinutes: input.startMinutes,
    endMinutes: input.startMinutes + input.durationMinutes
  };
  if (!rangesOverlapByMinute(selectedRange, openingRange) || selectedRange.endMinutes > openingRange.endMinutes) {
    throw new Error("Selected time is outside operating hours.");
  }

  const startAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes, facility.timezone);
  const endAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, selectedRange.endMinutes, facility.timezone);
  if (startAtUtc <= now) throw new Error("You can only book future time slots.");

  const [conflictingBooking, conflictingReschedule, blockedSchedule] = await Promise.all([
    tx.booking.findFirst({
      where: {
        facilityId: facility.id,
        ...activeBookingWhere(now),
        startAtUtc: { lt: endAtUtc },
        endAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    }),
    tx.bookingReschedule.findFirst({
      where: {
        replacementFacilityId: facility.id,
        OR: [
          { status: BookingRescheduleStatus.PAYMENT_SUBMITTED },
          { status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED, holdExpiresAt: { gt: now } }
        ],
        replacementStartAtUtc: { lt: endAtUtc },
        replacementEndAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    }),
    tx.blockedSchedule.findFirst({
      where: {
        facilityId: facility.id,
        startAtUtc: { lt: endAtUtc },
        endAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    })
  ]);

  if (conflictingBooking || conflictingReschedule || blockedSchedule) {
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

  return {
    facility,
    startAtUtc,
    endAtUtc,
    durationMinutes: input.durationMinutes,
    price
  };
}
