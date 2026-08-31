import { AdminNav } from "@/components/admin/admin-nav";
import { BookingDateSelector } from "@/components/bookings/booking-date-selector";
import { WalkInBookingForm } from "@/components/admin/walk-in-booking-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatDateLabel } from "@/lib/time/slots";
import { getBookingWindow } from "@/server/bookings/booking-window";
import { normalizeDateKeyWithinBookingWindow } from "@/server/bookings/booking-window";
import { getFacilityDayAvailability } from "@/server/bookings/service";
import { prisma } from "@/lib/db/prisma";
import { getFacilityPricingView } from "@/server/pricing/queries";

export const dynamic = "force-dynamic";

type AdminWalkInsPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function AdminWalkInsPage({ searchParams }: AdminWalkInsPageProps) {
  await requirePermission("bookings.create");
  const requestedDate = (await searchParams).date;
  const facilities = await prisma.facility.findMany({
    where: { isEnabled: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      operatingHours: true,
      pricingRules: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  const bookingWindow = getBookingWindow(process.env.APP_TIMEZONE ?? "Asia/Manila");
  const dateKey = normalizeDateKeyWithinBookingWindow(requestedDate, process.env.APP_TIMEZONE ?? "Asia/Manila");
  const dateLabel = formatDateLabel(dateKey, process.env.APP_TIMEZONE ?? "Asia/Manila");
  const facilityOptions = await Promise.all(
    facilities.map(async (facility) => {
      const availability = await getFacilityDayAvailability(facility, dateKey);
      const pricingView = await getFacilityPricingView(facility, dateKey);

      return {
        id: facility.id,
        name: facility.name,
        timezone: facility.timezone,
        priceQuotes: pricingView.quotes,
        slotIntervalMinutes: availability.slotIntervalMinutes,
        slots: availability.slots
      };
    })
  );

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Walk-in bookings"
        description="Verify the customer first, then create a confirmed desk booking with immediate payment capture."
      />
      <AdminNav current="walk-ins" />
      <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <BookingDateSelector dateKey={dateKey} maxDateKey={bookingWindow.maxDateKey} minDateKey={bookingWindow.minDateKey} />
        <p className="text-sm text-stone-400">Showing hourly slots for {dateLabel}. Walk-in bookings can only use future available slots.</p>
      </section>
      <WalkInBookingForm dateKey={dateKey} dateLabel={dateLabel} facilities={facilityOptions} />
    </main>
  );
}
