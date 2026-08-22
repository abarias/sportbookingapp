import Image from "next/image";
import { notFound } from "next/navigation";

import { BookingDateSelector } from "@/components/bookings/booking-date-selector";
import { BookingPanel } from "@/components/bookings/booking-panel";
import { RateCard } from "@/components/pricing/rate-card";
import { getSession } from "@/lib/auth/session";
import { formatDateLabel } from "@/lib/time/slots";
import { formatCurrency } from "@/lib/formatting/currency";
import { getBookingWindow, normalizeDateKeyWithinBookingWindow } from "@/server/bookings/booking-window";
import { getFacilityDayAvailability } from "@/server/bookings/service";
import { getFacilityBySlug, getFacilityTypeLabel } from "@/server/facilities/queries";
import { getFacilityPricingView } from "@/server/pricing/queries";

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
  const pricingView = await getFacilityPricingView(facility, dateKey);
  const primaryPrice = facility.pricingRules.find((rule) => rule.dayType === "DEFAULT");

  const dateLabel = formatDateLabel(dateKey, facility.timezone);

  return (
    <main className="space-y-8 pb-16">
      <section className="grid gap-6 lg:grid-cols-[1.28fr_0.72fr]">
        <section className="space-y-5 lg:order-1">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-300">{getFacilityTypeLabel(facility.type)}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-serif text-3xl text-white">{facility.name}</h1>
                <p className="mt-1 text-sm text-stone-300">
                  {primaryPrice ? `Base rates from ${formatCurrency(primaryPrice.amountMinor, "PHP")} per hour · VAT exclusive · 1-hour minimum` : "Pricing is temporarily unavailable"}
                </p>
              </div>
              <p className="rounded-full bg-amber-300/15 px-4 py-2 text-sm font-medium text-amber-100">
                Select hourly slots below
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-6">
            <BookingDateSelector dateKey={dateKey} maxDateKey={bookingWindow.maxDateKey} minDateKey={bookingWindow.minDateKey} />
            <p className="mt-4 text-sm text-stone-400">
              Showing hourly booking slots for {dateLabel} in {facility.timezone}. Bookings are open through {formatDateLabel(bookingWindow.maxDateKey, facility.timezone)}.
            </p>
          </div>

          <BookingPanel
            dateKey={dateKey}
            facilityId={facility.id}
            facilitySlug={facility.slug}
            isAuthenticated={Boolean(session?.user)}
            dateLabel={dateLabel}
            priceQuotes={pricingView.quotes}
            slotIntervalMinutes={availability.slotIntervalMinutes}
            slots={availability.slots}
          />
          {pricingView.pricingError ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">Online pricing is temporarily unavailable: {pricingView.pricingError}</p> : null}
          <RateCard rows={pricingView.rateCard} />
        </section>

        <aside className="space-y-4 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <details className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 lg:hidden">
            <summary className="cursor-pointer list-none p-5 text-sm font-medium text-white">
              View facility photos, pricing, and rules
            </summary>
            <div className="border-t border-white/10 p-4">
              <div className="flex snap-x gap-3 overflow-x-auto pb-3">
                {facility.images.map((image, index) => (
                  <div key={image.id} className="relative min-w-[82%] snap-start overflow-hidden rounded-[1.35rem] border border-white/10 sm:min-w-[58%]">
                    <Image
                      src={image.url}
                      alt={image.altText}
                      width={900}
                      height={620}
                      className="aspect-[16/10] w-full object-cover"
                      priority={index === 0}
                      unoptimized={image.url.startsWith("/facility_photos/")}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm leading-6 text-stone-300">{facility.description}</p>
            </div>
          </details>

          <div className="hidden overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 lg:block">
            <div className="flex snap-x gap-3 overflow-x-auto p-3">
              {facility.images.map((image, index) => (
                <div key={image.id} className="relative min-w-full snap-start overflow-hidden rounded-[1.35rem] border border-white/10">
                  <Image
                    src={image.url}
                    alt={image.altText}
                    width={900}
                    height={620}
                    className="aspect-[16/10] w-full object-cover"
                    priority={index === 0}
                    unoptimized={image.url.startsWith("/facility_photos/")}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300">{getFacilityTypeLabel(facility.type)}</p>
              <h2 className="font-serif text-2xl text-white">{facility.name}</h2>
              <p className="max-h-36 overflow-hidden text-sm leading-6 text-stone-300">{facility.description}</p>
            </div>
          </div>

          <div className="hidden gap-3 lg:grid">
            <aside className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Pricing</p>
              <p className="mt-3 text-2xl font-semibold text-white">{primaryPrice ? `From ${formatCurrency(primaryPrice.amountMinor, "PHP")}` : "Unavailable"}</p>
              <p className="mt-1 text-sm text-stone-300">
                Base rate per hour • VAT exclusive • 1-hour minimum
              </p>
            </aside>

            <aside className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-stone-300">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Booking rules</p>
              <ul className="mt-3 space-y-2">
                <li>Hourly booking increments only</li>
                <li>Slots are held after Reserve & Pay</li>
                <li>Final confirmation requires staff payment verification</li>
              </ul>
            </aside>
          </div>
        </aside>
      </section>
    </main>
  );
}
