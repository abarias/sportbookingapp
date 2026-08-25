import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { ReschedulePaymentReviewForm } from "@/components/admin/reschedule-payment-review-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminReschedulePaymentDetailData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminReschedulePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const authorization = await requirePermission("payments.view");
  const payment = await getAdminReschedulePaymentDetailData((await params).id);
  if (!payment) notFound();
  const reschedule = payment.bookingReschedule;
  const proofUrl = await getPaymentProofUrl(payment.proofImageUrl);
  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Payment verification" title="Reschedule adjustment payment" description="Verify only the additional amount. The customer’s original confirmed booking remains valid until approval." />
      <AdminNav current="payments" />
      <div className="flex flex-wrap gap-3"><Link className="text-sm text-amber-200 hover:underline" href="/admin/payments">Back to payment queue</Link><Link className="text-sm text-amber-200 hover:underline" href={`/admin/bookings/${reschedule.bookingId}`}>View booking history</Link></div>
      <section className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div><p className="text-xs uppercase tracking-[0.18em] text-amber-300">{payment.status.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-semibold text-white">{reschedule.originalFacility.name} → {reschedule.replacementFacility.name}</h2><p className="mt-2 text-sm text-stone-300">{reschedule.booking.user.fullName} · {reschedule.booking.user.phone ?? reschedule.booking.user.email}</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-stone-950/50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Original booking remains active</p><p className="mt-2 font-medium text-white">{reschedule.originalFacility.name}</p><p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(reschedule.originalStartAtUtc, reschedule.originalEndAtUtc, reschedule.originalTimezone)}</p><p className="mt-3 text-sm text-stone-400">Paid base amount: {formatCurrency(reschedule.originalAmountMinor, "PHP")}</p></article>
            <article className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-xs uppercase tracking-[0.16em] text-amber-300">Replacement held</p><p className="mt-2 font-medium text-white">{reschedule.replacementFacility.name}</p><p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(reschedule.replacementStartAtUtc, reschedule.replacementEndAtUtc, reschedule.replacementTimezone)}</p><p className="mt-3 text-sm text-stone-400">New base amount: {formatCurrency(reschedule.replacementAmountMinor, "PHP")}</p></article>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-300 md:grid-cols-2"><p>Additional amount due: <span className="text-white">{formatCurrency(payment.amountMinor, "PHP")}</span></p><p>Waived amount: <span className="text-white">{formatCurrency(reschedule.waivedAmountMinor, "PHP")}</span></p><p>Method: <span className="text-white">{payment.method?.replaceAll("_", " ") ?? "Not set"}</span></p><p>Transfer reference: <span className="text-white">{payment.externalReference ?? "Not set"}</span></p><p>Proof submitted: <span className="text-white">{payment.submittedAt ? formatInTimeZone(payment.submittedAt, "Asia/Manila", "MMM d, yyyy h:mm a") : "Not submitted"}</span></p><p>Initiated by: <span className="text-white">{reschedule.initiatedBy.fullName}</span></p></div>
          {proofUrl ? <Link href={proofUrl} target="_blank" className="block overflow-hidden rounded-2xl border border-white/10"><Image src={proofUrl} alt="Additional payment proof" width={900} height={600} className="max-h-[520px] w-full object-contain" /></Link> : <p className="rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-400">No proof image uploaded.</p>}
        </div>
        {payment.status === "SUBMITTED" && authorization.permissions.has("payments.verify") ? <ReschedulePaymentReviewForm paymentId={payment.id} /> : <aside className="rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-300"><p className="font-medium text-white">Review status</p><p className="mt-2">{payment.status.replaceAll("_", " ")}</p>{payment.reviewNote ? <p className="mt-3 text-stone-400">{payment.reviewNote}</p> : null}{payment.verifiedBy ? <p className="mt-3">Reviewed by {payment.verifiedBy.fullName}</p> : null}</aside>}
      </section>
    </main>
  );
}
