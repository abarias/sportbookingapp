import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeading } from "@/components/shared/section-heading";
import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { Button } from "@/components/ui/button";
import { requireUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { canCustomerCancelBooking, resolveCancellationEnabled, resolveCancellationWindowHours } from "@/server/bookings/policies";

export const dynamic = "force-dynamic";

export default async function CustomerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession();
  const { id } = await params;
  const [booking, cancellationEnabledSetting, cancellationWindowSetting] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, userId: session.user.id },
      include: {
      facility: { select: { name: true, cancellationEnabledOverride: true, cancellationWindowHoursOverride: true } },
      bookingOrder: { select: { id: true, reference: true } },
      reschedules: {
        orderBy: { createdAt: "desc" },
        include: { originalFacility: { select: { name: true } }, replacementFacility: { select: { name: true } } }
      }
      }
    }),
    prisma.appSetting.findUnique({ where: { key: "booking.cancellationEnabled" } }),
    prisma.appSetting.findUnique({ where: { key: "booking.cancellationWindowHours" } })
  ]);
  if (!booking) notFound();
  const isCancellable = canCustomerCancelBooking({
    bookingStatus: booking.status,
    startAtUtc: booking.startAtUtc,
    createdAt: booking.createdAt,
    now: new Date(),
    cancellationEnabled: resolveCancellationEnabled(cancellationEnabledSetting?.value === true, booking.facility.cancellationEnabledOverride),
    cancellationWindowHours: resolveCancellationWindowHours(typeof cancellationWindowSetting?.value === "number" ? cancellationWindowSetting.value : 24, booking.facility.cancellationWindowHoursOverride)
  });

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Booking" title={booking.reference ?? `Booking ${booking.id.slice(0, 8).toUpperCase()}`} description="Current schedule and booking history." />
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.18em] text-amber-300">{booking.status.replaceAll("_", " ")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{booking.facility.name}</h2>
        <p className="mt-2 text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
        <p className="mt-3 text-amber-100">{formatCurrency(booking.amountMinor, "PHP")} VAT exclusive</p>
        {booking.bookingOrder ? <Link className="mt-5 inline-flex text-sm text-amber-200 hover:underline" href={`/orders/${booking.bookingOrder.id}`}>Part of order {booking.bookingOrder.reference}</Link> : null}
        {isCancellable ? <div className="mt-5"><CancelBookingButton bookingId={booking.id} /></div> : null}
      </section>
      {booking.reschedules.length ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Schedule history</h2>
          <div className="mt-4 space-y-3">{booking.reschedules.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300"><p>{item.originalFacility.name}: {formatDateTimeRange(item.originalStartAtUtc, item.originalEndAtUtc, item.originalTimezone)}</p><p className="mt-1 text-white">Moved to {item.replacementFacility.name}: {formatDateTimeRange(item.replacementStartAtUtc, item.replacementEndAtUtc, item.replacementTimezone)}</p><p className="mt-1 text-stone-500">{item.status.replaceAll("_", " ")}</p></article>)}</div>
        </section>
      ) : null}
      <Button asChild variant="secondary"><Link href="/bookings">Back to booking history</Link></Button>
    </main>
  );
}
