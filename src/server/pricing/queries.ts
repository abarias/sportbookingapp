import type { Facility, FacilityOperatingHour, PricingRule } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getDayOfWeek } from "@/lib/time/slots";
import { calculatePrice, deriveRateCard } from "@/server/pricing/engine";
import { getSafeActionError } from "@/lib/observability/action-errors";

type PriceableFacility = Pick<Facility, "id" | "timezone" | "slotIntervalMinutes"> & {
  operatingHours: FacilityOperatingHour[];
  pricingRules: PricingRule[];
};

export async function getFacilityPricingView(facility: PriceableFacility, dateKey: string) {
  const holidayDate = new Date(`${dateKey}T00:00:00.000Z`);
  const holidays = await prisma.holiday.findMany({
    where: {
      date: holidayDate,
      isActive: true,
      OR: [{ facilityId: null }, { facilityId: facility.id }]
    }
  });
  const dayOfWeek = getDayOfWeek(dateKey, facility.timezone);
  const operatingHour = facility.operatingHours.find((hours) => hours.dayOfWeek === dayOfWeek);
  const quotes = [];
  let pricingError: string | null = null;

  if (operatingHour && !operatingHour.isClosed) {
    for (let startMinutes = operatingHour.opensAtMinutes; startMinutes + 60 <= operatingHour.closesAtMinutes; startMinutes += 60) {
      try {
        quotes.push(calculatePrice({
          facilityId: facility.id,
          timezone: facility.timezone,
          dateKey,
          startMinutes,
          durationMinutes: 60,
          intervalMinutes: facility.slotIntervalMinutes,
          rules: facility.pricingRules,
          holidays
        }));
      } catch (error) {
        pricingError = getSafeActionError(error, "Pricing is not available for this date.", "pricing.rate-card.failed", { facilityId: facility.id, dateKey });
        quotes.length = 0;
        break;
      }
    }
  }

  return {
    rateCard: deriveRateCard(facility.pricingRules),
    quotes,
    holiday: holidays[0] ?? null,
    pricingError
  };
}

export async function getPricingAdminData(facilityId?: string, dateKey?: string, startMinutes = 480, durationMinutes = 60) {
  const facilities = await prisma.facility.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      pricingRules: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      operatingHours: { orderBy: { dayOfWeek: "asc" } }
    }
  });
  const selectedFacility = facilities.find((facility) => facility.id === facilityId) ?? facilities[0] ?? null;
  const holidays = await prisma.holiday.findMany({
    orderBy: [{ date: "asc" }, { name: "asc" }],
    include: { facility: { select: { name: true } } }
  });

  const futureBookingCount = selectedFacility
    ? await prisma.booking.count({
        where: {
          facilityId: selectedFacility.id,
          startAtUtc: { gt: new Date() },
          status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED"] }
        }
      })
    : 0;

  if (!selectedFacility || !dateKey) {
    return { facilities, selectedFacility, holidays, preview: null, futureBookingCount };
  }

  const applicableHolidays = holidays.filter((holiday) => holiday.facilityId === null || holiday.facilityId === selectedFacility.id);
  const dayOfWeek = getDayOfWeek(dateKey, selectedFacility.timezone);
  const hours = selectedFacility.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);
  let preview = null;
  if (hours && !hours.isClosed && startMinutes >= hours.opensAtMinutes && startMinutes + durationMinutes <= hours.closesAtMinutes) {
    try {
      preview = calculatePrice({
        facilityId: selectedFacility.id,
        timezone: selectedFacility.timezone,
        dateKey,
        startMinutes,
        durationMinutes,
        intervalMinutes: selectedFacility.slotIntervalMinutes,
        rules: selectedFacility.pricingRules,
        holidays: applicableHolidays
      });
    } catch {
      preview = null;
    }
  }

  return { facilities, selectedFacility, holidays, preview, futureBookingCount };
}
