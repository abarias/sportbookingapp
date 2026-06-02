import Image from "next/image";
import { notFound } from "next/navigation";

import { BookingPanel } from "@/components/bookings/booking-panel";
import { SlotGrid } from "@/components/bookings/slot-grid";
import { getSession } from "@/lib/auth/session";
import { formatDateLabel } from "@/lib/time/slots";
import { formatCurrency } from "@/lib/formatting/currency";
import { getBookingWindow, normalizeDateKeyWithinBookingWindow } from "@/server/bookings/booking-window";
import { getFacilityDayAvailability } from "@/server/bookings/service";
import { getFacilityBySlug, getFacilityTypeLabel } from "@/server/facilities/queries";

export const dynamic = "force-dynamic";

type FacilityDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    date?: string;
  }>;
};

export default async function FacilityDetailPage({ params, searchParams }: FacilityDetailPageProps) {
  const { slug } = await params;
  const facility = await getFacilityBySlug(slug);
  const session = await getSession();

  if (!facility) {
    notFound();
  }

  const bookingWindow = getBookingWindow(facility.timezone);
  const dateKey = normalizeDateKeyWithinBookingWindow((await searchParams).date, facility.timezone);
  const availability = await getFacilityDayAvailability(facility, dateKey);
  const primaryPrice = facility.pricingRules[0];

  if (!primaryPrice) {
    notFound();
  }

  return (
    <main className="space-y-10 pb-16">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {facility.images.map((image, index) => (
              <div key={image.id} className="relative min-w-full snap-start overflow-hidden rounded-[2rem] border border-white/10">
                <Image
                  src={image.url}
                  alt={image.altText}
                  width={1400}
                  height={900}
                  className="aspect-[16/10] w-full object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">{getFacilityTypeLabel(facility.type)}</p>
            <h1 className="font-serif text-4xl text-white">{facility.name}</h1>
            <p className="max-w-3xl text-base leading-7 text-stone-300">{facility.description}</p>
          </div>
        </div>

        <div className="space-y-5">
          <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Pricing</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {formatCurrency(primaryPrice.amountMinor, "PHP")}
            </p>
            <p className="mt-2 text-sm text-stone-300">
              {primaryPrice.billingMode === "PER_HOUR" ? "Per hour" : "Per booking block"} • Minimum {primaryPrice.minimumMinutes} minutes
            </p>
            <ul className="mt-6 space-y-3 text-sm text-stone-300">
              <li>30-minute minimum increments</li>
              <li>Availability accounts for confirmed bookings, valid pending bookings, and blocked schedules</li>
              <li>Reservations are confirmed as soon as payment is completed successfully</li>
            </ul>
          </aside>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-stone-200" htmlFor="date">
                  Booking date
                </label>
                <input
                  className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white"
                  defaultValue={dateKey}
                  id="date"
                  min={bookingWindow.minDateKey}
                  max={bookingWindow.maxDateKey}
                  name="date"
                  required
                  type="date"
                />
              </div>
              <button
                className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/15"
                type="submit"
              >
                Check availability
              </button>
            </form>
            <p className="mt-4 text-sm text-stone-400">
              Showing slots for {formatDateLabel(dateKey, facility.timezone)} in {facility.timezone}. Bookings are open through {formatDateLabel(bookingWindow.maxDateKey, facility.timezone)}.
            </p>
          </div>

          <BookingPanel
            dateKey={dateKey}
            facilityId={facility.id}
            facilitySlug={facility.slug}
            isAuthenticated={Boolean(session?.user)}
            slotIntervalMinutes={availability.slotIntervalMinutes}
            slots={availability.slots}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Availability</p>
          <h2 className="font-serif text-3xl text-white">Live slot status</h2>
          <p className="text-sm leading-7 text-stone-300">
            Each card represents one 30-minute slot. Past times are automatically disabled, and only future valid start times can be reserved.
          </p>
          <p className="text-sm text-stone-400">Viewing slots for {formatDateLabel(dateKey, facility.timezone)}.</p>
        </div>
        <SlotGrid slots={availability.slots} />
      </section>
    </main>
  );
}
