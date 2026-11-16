import { PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { PaymentReviewForm } from "@/components/admin/payment-review-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange, minutesToTimeLabel } from "@/lib/time/slots";
import { getAdminPaymentDetailData } from "@/server/admin/queries";
import { parsePriceSnapshot } from "@/server/pricing/snapshot";

export const dynamic = "force-dynamic";

const paymentLabels: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment", SUBMITTED: "For Verification", VERIFIED: "Verified", REJECTED: "Rejected",
  ACTION_REQUIRED: "Action Required", PENDING: "Pending", PAID: "Paid", FAILED: "Failed", EXPIRED: "Expired", REFUNDED: "Refunded"
};

export default async function AdminPaymentDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const authorization = await requirePermission("payments.view");
  const { id } = await params;
  const query = await searchParams;
  const payment = await getAdminPaymentDetailData(id);
  if (!payment || (!payment.booking && !payment.bookingOrder)) notFound();

  const order = payment.bookingOrder;
  const legacyBooking = payment.booking;
  const bookings = order?.bookings ?? (legacyBooking ? [legacyBooking] : []);
  const customer = order?.user ?? legacyBooking?.user;
  const timezone = bookings[0]?.timezone ?? "Asia/Manila";
  const reference = order?.reference ?? payment.providerReference ?? `PAY-${payment.id.slice(0, 8).toUpperCase()}`;
  const paymentProofUrl = await getPaymentProofUrl(payment.proofImageUrl);

  const outcomeMessage = query.outcome === "verified"
    ? "Payment confirmed successfully. All included bookings are now confirmed."
    : query.outcome === "rejected"
      ? "Payment rejected successfully. The reservation slots have been released."
      : query.outcome === "action-required"
        ? "Customer action requested successfully."
        : null;

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin" title="Payment review" description="Verify one payment against every booking it covers before confirming inventory." />
      {outcomeMessage ? <p aria-live="polite" className={`rounded-2xl border p-4 text-sm ${query.outcome === "rejected" ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>{outcomeMessage}</p> : null}
      <AdminNav current="payments" />
      <Link className="inline-flex text-sm font-medium text-amber-200 hover:underline" href="/admin/payments">Back to payment queue</Link>

      <article className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-sm uppercase tracking-[0.2em] text-amber-300">{paymentLabels[payment.status]}</p><h2 className="mt-2 text-xl font-semibold text-white">{order ? `${bookings.length} booking order` : legacyBooking?.facility.name}</h2></div>
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">{reference}</span>
          </div>

          <section className="space-y-3" aria-labelledby="covered-bookings">
            <h3 id="covered-bookings" className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">Included bookings</h3>
            {bookings.map((booking) => {
              const snapshot = parsePriceSnapshot(booking.priceSnapshot);
              return <article key={booking.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-medium text-white">{booking.facility.name}</p><p className="text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p><Link className="mt-2 inline-flex text-xs text-amber-200 hover:underline" href={`/admin/bookings/${booking.id}`}>{booking.reference ?? "Open booking"}</Link></div><p className="text-sm text-amber-100">{formatCurrency(booking.amountMinor, "PHP")}</p></div>{snapshot?.segments.length ? <div className="mt-3 border-t border-white/10 pt-3">{snapshot.segments.map((segment) => <div key={`${segment.startMinutes}-${segment.ruleId}`} className="flex justify-between gap-3 text-xs text-stone-400"><span>{minutesToTimeLabel(segment.startMinutes)}-{minutesToTimeLabel(segment.endMinutes)} · {segment.rateLabel}</span><span>{formatCurrency(segment.amountMinor, "PHP")}</span></div>)}</div> : null}</article>;
            })}
          </section>

          <div className="grid gap-3 text-sm text-stone-300 md:grid-cols-2">
            <p><span className="text-stone-500">Customer:</span> {customer?.fullName}</p><p><span className="text-stone-500">Email:</span> {customer?.email}</p>
            <p><span className="text-stone-500">Phone:</span> {customer?.phone ?? "Not provided"}</p><p><span className="text-stone-500">VAT-exclusive amount due:</span> {formatCurrency(payment.amountMinor, "PHP")}</p>
            <p><span className="text-stone-500">Method:</span> {payment.method?.replaceAll("_", " ") ?? "Not set"}</p><p><span className="text-stone-500">Transfer ref:</span> {payment.externalReference ?? "Not set"}</p>
            <p><span className="text-stone-500">Proof uploaded:</span> {payment.submittedAt ? formatInTimeZone(payment.submittedAt, timezone, "MMM d, h:mm a") : "Not submitted"}</p>
          </div>
          {payment.duplicateReference ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">Possible duplicate transfer reference. Verify carefully against the payment account.</p> : null}
          {payment.reviewNote ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Staff note: {payment.reviewNote}</p> : null}
          {paymentProofUrl ? <Link href={paymentProofUrl} target="_blank" className="block overflow-hidden rounded-2xl border border-white/10"><Image src={paymentProofUrl} alt={`Payment proof for ${reference}`} width={900} height={600} className="max-h-[520px] w-full object-contain" /></Link> : <p className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-400">No proof image uploaded.</p>}
        </div>
        {payment.status === PaymentStatus.SUBMITTED && authorization.permissions.has("payments.verify") ? <PaymentReviewForm paymentId={payment.id} /> : <section className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300"><p className="font-medium text-white">Current status</p><p>{paymentLabels[payment.status]}</p>{payment.verifiedBy ? <p>Last reviewed by {payment.verifiedBy.fullName}</p> : null}</section>}
      </article>
    </main>
  );
}
