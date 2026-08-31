import { BookingOrderStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireUserSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getCustomerOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession();

  const { id } = await params;
  const order = await getCustomerOrder(session.user.id, id);
  if (!order) notFound();

  const canViewPayment = order.status !== BookingOrderStatus.CONFIRMED || Boolean(order.payment?.proofImageUrl);

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Booking order"
        title={order.reference}
        description="One consolidated payment record with individually traceable facility bookings."
      />
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-amber-300">{order.status.replaceAll("_", " ")}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(order.baseAmountMinor, "PHP")}</p>
            <p className="text-sm text-stone-400">Original VAT-exclusive checkout amount</p>
          </div>
          {canViewPayment ? <Button asChild><Link href={`/orders/${order.id}/payment`}>View payment</Link></Button> : null}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {order.bookings.map((booking) => (
            <article key={booking.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-5">
              <div className="flex justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{booking.reference}</p>
                <span className="text-xs text-stone-400">{booking.status.replaceAll("_", " ")}</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-white">{booking.facility.name}</h2>
              <p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
              <p className="mt-3 text-sm text-amber-100">{formatCurrency(booking.amountMinor, "PHP")} VAT exclusive</p>
              <Link className="mt-4 inline-flex text-sm text-amber-200 hover:underline" href={`/bookings/${booking.id}`}>
                Booking reference details
              </Link>
            </article>
          ))}
        </div>
      </section>
      <Button asChild variant="secondary"><Link href="/bookings">Back to booking history</Link></Button>
    </main>
  );
}
