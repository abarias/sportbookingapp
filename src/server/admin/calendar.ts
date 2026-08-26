import { BookingRescheduleStatus, BookingStatus, PaymentStatus, Prisma, type Facility, type FacilityOperatingHour } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db/prisma";
import { formatDateLabel, getDayOfWeek, getLocalMinutesForDate, minutesToTimeLabel } from "@/lib/time/slots";
import { buildDaySlots, type DaySlot, type MinuteInterval } from "@/server/bookings/core";

type CalendarFacility = Pick<Facility, "id" | "name" | "timezone" | "slotIntervalMinutes" | "isEnabled"> & {
  operatingHours: Array<Pick<FacilityOperatingHour, "dayOfWeek" | "opensAtMinutes" | "closesAtMinutes" | "isClosed">>;
};

type CalendarBooking = {
  id: string;
  facilityId: string;
  status: BookingStatus;
  startAtUtc: Date;
  endAtUtc: Date;
  timezone: string;
  user: {
    fullName: string;
    email: string | null;
  };
};

type CalendarBlock = {
  id: string;
  facilityId: string;
  title: string;
  reason: string | null;
  startAtUtc: Date;
  endAtUtc: Date;
};

type CalendarReplacementHold = {
  id: string;
  replacementFacilityId: string;
  replacementStartAtUtc: Date;
  replacementEndAtUtc: Date;
};

type DayFacilitySchedule = {
  facilityId: string;
  facilityName: string;
  timezone: string;
  slotIntervalMinutes: number;
  isEnabled: boolean;
  openingRange: MinuteInterval | null;
  slots: DaySlot[];
  bookings: CalendarBooking[];
  blockedSchedules: CalendarBlock[];
  replacementHolds: CalendarReplacementHold[];
  summary: {
    bookedSlotCount: number;
    blockedSlotCount: number;
    availableSlotCount: number;
    isFullyBooked: boolean;
    isFullyBlocked: boolean;
    hasBookings: boolean;
  };
};

export type AdminCalendarMonthDay = {
  dateKey: string;
  label: string;
  isCurrentMonth: boolean;
  bookingCount: number;
  bookedFacilityNames: string[];
  fullyBookedFacilityNames: string[];
  fullyBlockedFacilityNames: string[];
};

export type AdminCalendarPageData = {
  timezone: string;
  monthKey: string;
  selectedDateKey: string;
  monthLabel: string;
  previousMonthKey: string;
  nextMonthKey: string;
  days: AdminCalendarMonthDay[];
  daySchedules: DayFacilitySchedule[];
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

function getTimezone() {
  return process.env.APP_TIMEZONE ?? "Asia/Manila";
}

function getMonthKeyFromDate(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM");
}

function normalizeMonthKey(value: string | undefined, timezone: string) {
  if (value && MONTH_KEY_PATTERN.test(value)) {
    return value;
  }

  return getMonthKeyFromDate(new Date(), timezone);
}

function getMonthBoundaryKeys(monthKey: string, timezone: string) {
  const firstOfMonthUtc = fromZonedTime(`${monthKey}-01T12:00:00`, timezone);
  const monthStartKey = formatInTimeZone(firstOfMonthUtc, timezone, "yyyy-MM-01");
  const lastOfMonthUtc = subDays(addDays(firstOfMonthUtc, 32), Number(formatInTimeZone(addDays(firstOfMonthUtc, 32), timezone, "d")));
  const monthEndKey = formatInTimeZone(lastOfMonthUtc, timezone, "yyyy-MM-dd");

  const startWeekday = Number.parseInt(formatInTimeZone(firstOfMonthUtc, timezone, "i"), 10) % 7;
  const endWeekday = Number.parseInt(formatInTimeZone(lastOfMonthUtc, timezone, "i"), 10) % 7;

  const gridStartKey = formatInTimeZone(subDays(firstOfMonthUtc, startWeekday), timezone, "yyyy-MM-dd");
  const gridEndKey = formatInTimeZone(addDays(lastOfMonthUtc, 6 - endWeekday), timezone, "yyyy-MM-dd");

  return {
    monthStartKey,
    monthEndKey,
    gridStartKey,
    gridEndKey,
    previousMonthKey: getMonthKeyFromDate(subDays(firstOfMonthUtc, 1), timezone),
    nextMonthKey: getMonthKeyFromDate(addDays(lastOfMonthUtc, 1), timezone),
    monthLabel: formatInTimeZone(firstOfMonthUtc, timezone, "MMMM yyyy")
  };
}

function listDateKeys(startKey: string, endKey: string, timezone: string) {
  const keys: string[] = [];
  let cursor = fromZonedTime(`${startKey}T12:00:00`, timezone);
  const endUtc = fromZonedTime(`${endKey}T12:00:00`, timezone);

  while (cursor <= endUtc) {
    keys.push(formatInTimeZone(cursor, timezone, "yyyy-MM-dd"));
    cursor = addDays(cursor, 1);
  }

  return keys;
}

function getOpeningRange(facility: CalendarFacility, dateKey: string): MinuteInterval | null {
  const dayOfWeek = getDayOfWeek(dateKey, facility.timezone);
  const hours = facility.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);

  if (!hours || hours.isClosed) {
    return null;
  }

  return {
    startMinutes: hours.opensAtMinutes,
    endMinutes: hours.closesAtMinutes
  };
}

function getLocalDayRange(dateKey: string, timezone: string) {
  const dayStartUtc = fromZonedTime(`${dateKey}T00:00:00`, timezone);
  const nextDayKey = formatInTimeZone(addDays(fromZonedTime(`${dateKey}T12:00:00`, timezone), 1), timezone, "yyyy-MM-dd");
  const dayEndUtc = fromZonedTime(`${nextDayKey}T00:00:00`, timezone);

  return {
    dayStartUtc,
    dayEndUtc
  };
}

function filterBookingsForDate(bookings: CalendarBooking[], dateKey: string, timezone: string) {
  const { dayStartUtc, dayEndUtc } = getLocalDayRange(dateKey, timezone);

  return bookings.filter((booking) => booking.startAtUtc < dayEndUtc && booking.endAtUtc > dayStartUtc);
}

function filterBlocksForDate(blocks: CalendarBlock[], dateKey: string, timezone: string) {
  const { dayStartUtc, dayEndUtc } = getLocalDayRange(dateKey, timezone);

  return blocks.filter((block) => block.startAtUtc < dayEndUtc && block.endAtUtc > dayStartUtc);
}

function filterReplacementHoldsForDate(holds: CalendarReplacementHold[], dateKey: string, timezone: string) {
  const { dayStartUtc, dayEndUtc } = getLocalDayRange(dateKey, timezone);
  return holds.filter((hold) => hold.replacementStartAtUtc < dayEndUtc && hold.replacementEndAtUtc > dayStartUtc);
}

function buildFacilityDaySchedule(args: {
  facility: CalendarFacility;
  dateKey: string;
  bookings: CalendarBooking[];
  blockedSchedules: CalendarBlock[];
  replacementHolds: CalendarReplacementHold[];
}) {
  const openingRange = getOpeningRange(args.facility, args.dateKey);

  if (!openingRange) {
    return {
      facilityId: args.facility.id,
      facilityName: args.facility.name,
      timezone: args.facility.timezone,
      slotIntervalMinutes: args.facility.slotIntervalMinutes,
      isEnabled: args.facility.isEnabled,
      openingRange: null,
      slots: [],
      bookings: args.bookings,
      blockedSchedules: args.blockedSchedules,
      replacementHolds: args.replacementHolds,
      summary: {
        bookedSlotCount: 0,
        blockedSlotCount: 0,
        availableSlotCount: 0,
        isFullyBooked: false,
        isFullyBlocked: false,
        hasBookings: args.bookings.length > 0 || args.replacementHolds.length > 0
      }
    };
  }

  const busyIntervals = [
    ...args.bookings.map((booking) => ({
      startMinutes: getLocalMinutesForDate(booking.startAtUtc, args.dateKey, args.facility.timezone),
      endMinutes: getLocalMinutesForDate(booking.endAtUtc, args.dateKey, args.facility.timezone),
      reason: "BOOKED" as const
    })),
    ...args.replacementHolds.map((hold) => ({
      startMinutes: getLocalMinutesForDate(hold.replacementStartAtUtc, args.dateKey, args.facility.timezone),
      endMinutes: getLocalMinutesForDate(hold.replacementEndAtUtc, args.dateKey, args.facility.timezone),
      reason: "BOOKED" as const
    })),
    ...args.blockedSchedules.map((block) => ({
      startMinutes: getLocalMinutesForDate(block.startAtUtc, args.dateKey, args.facility.timezone),
      endMinutes: getLocalMinutesForDate(block.endAtUtc, args.dateKey, args.facility.timezone),
      reason: "BLOCKED" as const
    }))
  ].filter((interval) => interval.endMinutes > openingRange.startMinutes && interval.startMinutes < openingRange.endMinutes);

  const slots = buildDaySlots({
    openingRange,
    slotIntervalMinutes: args.facility.slotIntervalMinutes,
    busyIntervals
  });

  const bookedSlotCount = slots.filter((slot) => slot.reason === "BOOKED").length;
  const blockedSlotCount = slots.filter((slot) => slot.reason === "BLOCKED").length;
  const availableSlotCount = slots.filter((slot) => slot.reason === "AVAILABLE").length;

  return {
    facilityId: args.facility.id,
    facilityName: args.facility.name,
    timezone: args.facility.timezone,
    slotIntervalMinutes: args.facility.slotIntervalMinutes,
    isEnabled: args.facility.isEnabled,
    openingRange,
    slots,
    bookings: args.bookings,
    blockedSchedules: args.blockedSchedules,
    replacementHolds: args.replacementHolds,
    summary: {
      bookedSlotCount,
      blockedSlotCount,
      availableSlotCount,
      isFullyBooked: slots.length > 0 && availableSlotCount === 0 && bookedSlotCount > 0,
      isFullyBlocked: slots.length > 0 && availableSlotCount === 0 && blockedSlotCount > 0 && bookedSlotCount === 0,
      hasBookings: args.bookings.length > 0 || args.replacementHolds.length > 0
    }
  };
}

export async function getAdminCalendarData(params: {
  month?: string;
  date?: string;
  fullCustomerAccess?: boolean;
}) : Promise<AdminCalendarPageData> {
  const timezone = getTimezone();
  const monthKey = normalizeMonthKey(params.month, timezone);
  const { monthStartKey, gridStartKey, gridEndKey, previousMonthKey, nextMonthKey, monthLabel } = getMonthBoundaryKeys(monthKey, timezone);
  const selectedDateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : monthStartKey;
  const dateKeys = listDateKeys(gridStartKey, gridEndKey, timezone);
  const gridStartUtc = fromZonedTime(`${gridStartKey}T00:00:00`, timezone);
  const gridEndExclusiveUtc = fromZonedTime(`${formatInTimeZone(addDays(fromZonedTime(`${gridEndKey}T12:00:00`, timezone), 1), timezone, "yyyy-MM-dd")}T00:00:00`, timezone);
  const now = new Date();

  const bookingWhere: Prisma.BookingWhereInput = {
    OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.HELD, OR: [{ paymentHoldExpiresAt: { gt: now }, payment: { status: PaymentStatus.AWAITING_PAYMENT } }, { payment: { status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.ACTION_REQUIRED] } } }] },
      { status: BookingStatus.PENDING_PAYMENT, paymentHoldExpiresAt: { gt: now } }
    ],
    startAtUtc: { lt: gridEndExclusiveUtc },
    endAtUtc: { gt: gridStartUtc }
  };
  const bookingQuery = params.fullCustomerAccess
    ? prisma.booking.findMany({ where: bookingWhere, orderBy: { startAtUtc: "asc" }, include: { user: { select: { fullName: true, email: true } } } })
    : prisma.booking.findMany({ where: bookingWhere, orderBy: { startAtUtc: "asc" }, include: { user: { select: { fullName: true } } } });

  const [facilities, rawBookings, blockedSchedules, replacementHolds] = await Promise.all([
    prisma.facility.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        operatingHours: {
          orderBy: { dayOfWeek: "asc" }
        }
      }
    }),
    bookingQuery,
    prisma.blockedSchedule.findMany({
      where: {
        startAtUtc: {
          lt: gridEndExclusiveUtc
        },
        endAtUtc: {
          gt: gridStartUtc
        }
      },
      orderBy: { startAtUtc: "asc" }
    }),
    prisma.bookingReschedule.findMany({
      where: {
        OR: [
          { status: BookingRescheduleStatus.PAYMENT_SUBMITTED },
          { status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED, holdExpiresAt: { gt: now } }
        ],
        replacementStartAtUtc: { lt: gridEndExclusiveUtc },
        replacementEndAtUtc: { gt: gridStartUtc }
      },
      select: { id: true, replacementFacilityId: true, replacementStartAtUtc: true, replacementEndAtUtc: true }
    })
  ]);
  const bookings: CalendarBooking[] = rawBookings.map((booking) => ({
    ...booking,
    user: { fullName: booking.user.fullName, email: "email" in booking.user && typeof booking.user.email === "string" ? booking.user.email : null }
  }));

  const days = dateKeys.map((dateKey) => {
    const schedules = facilities.map((facility) =>
      buildFacilityDaySchedule({
        facility,
        dateKey,
        bookings: filterBookingsForDate(bookings.filter((booking) => booking.facilityId === facility.id), dateKey, facility.timezone),
        blockedSchedules: filterBlocksForDate(blockedSchedules.filter((block) => block.facilityId === facility.id), dateKey, facility.timezone),
        replacementHolds: filterReplacementHoldsForDate(replacementHolds.filter((hold) => hold.replacementFacilityId === facility.id), dateKey, facility.timezone)
      })
    );

    return {
      dateKey,
      label: formatDateLabel(dateKey, timezone),
      isCurrentMonth: dateKey.startsWith(monthKey),
      bookingCount: schedules.reduce((sum, schedule) => sum + schedule.bookings.length, 0),
      bookedFacilityNames: schedules.filter((schedule) => schedule.summary.hasBookings).map((schedule) => schedule.facilityName),
      fullyBookedFacilityNames: schedules.filter((schedule) => schedule.summary.isFullyBooked).map((schedule) => schedule.facilityName),
      fullyBlockedFacilityNames: schedules.filter((schedule) => schedule.summary.isFullyBlocked).map((schedule) => schedule.facilityName)
    };
  });

  const daySchedules = facilities.map((facility) =>
    buildFacilityDaySchedule({
      facility,
      dateKey: selectedDateKey,
      bookings: filterBookingsForDate(bookings.filter((booking) => booking.facilityId === facility.id), selectedDateKey, facility.timezone),
      blockedSchedules: filterBlocksForDate(blockedSchedules.filter((block) => block.facilityId === facility.id), selectedDateKey, facility.timezone),
      replacementHolds: filterReplacementHoldsForDate(replacementHolds.filter((hold) => hold.replacementFacilityId === facility.id), selectedDateKey, facility.timezone)
    })
  );

  return {
    timezone,
    monthKey,
    selectedDateKey,
    monthLabel,
    previousMonthKey,
    nextMonthKey,
    days,
    daySchedules
  };
}

export function formatSlotRange(startMinutes: number, endMinutes: number) {
  return `${minutesToTimeLabel(startMinutes)} - ${minutesToTimeLabel(endMinutes)}`;
}
