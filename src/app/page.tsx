import Link from "next/link";

import { FacilityCard } from "@/components/shared/facility-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatting/currency";
import { getFacilityCards } from "@/server/facilities/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const facilities = await getFacilityCards();

  return (
    <main className="space-y-16 pb-16">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(135deg,#0c0a09_0%,#1c1917_45%,#292524_100%)] px-6 py-14 shadow-2xl shadow-amber-500/10 sm:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300">MVP Sports Booking</p>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-serif text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                Book courts in minutes with immediate mock-confirmed reservations.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
                Built for Philippine sports facilities with clear availability, 30-minute slots, and a temporary mock
                payment path until a live gateway is selected.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/facilities">Browse facilities</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/admin">Open admin preview</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {facilities.slice(0, 2).map((facility) => (
              <div key={facility.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-sm text-stone-400">{facility.typeLabel}</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{facility.name}</h2>
                <p className="mt-3 text-sm text-stone-300">{facility.description}</p>
                <p className="mt-4 text-sm text-amber-300">
                  Starts at {formatCurrency(facility.price.amountMinor, facility.price.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Facilities"
          title="Core inventory for launch"
          description="Whole courts, half courts, pickleball, and badminton all sit under the live facility model now backed by PostgreSQL."
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {facilities.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      </section>
    </main>
  );
}
