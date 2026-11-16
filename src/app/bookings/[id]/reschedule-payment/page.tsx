import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";

import { ReschedulePaymentProofForm } from "@/components/bookings/reschedule-payment-proof-form";
import { CustomerBankTransferDetails } from "@/components/payments/customer-bank-transfer-details";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireUserSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange } from "@/lib/time/slots";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerReschedulePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserSession();
  const booking = await prisma.booking.findFirst({
    where: { id: (await params).id, userId: session.user.id },
    include: {
      facility: true,
      reschedules: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { originalFacility: true, replacementFacility: true, additionalPayment: true }
      }
    }
  });
  if (!booking) notFound();
  const reschedule = booking.reschedules[0];
  if (!reschedule?.additionalPayment) notFound();
  const proofUrl = await getPaymentProofUrl(reschedule.additionalPayment.proofImageUrl);
  const canSubmit = reschedule.status === "ADDITIONAL_PAYMENT_REQUIRED" && reschedule.additionalPayment.status === "AWAITING_PAYMENT" && Boolean(reschedule.holdExpiresAt && reschedule.holdExpiresAt > new Date());
  return (
    <main className="space-y-5 pb-16 sm:space-y-8">
      <SectionHeading compact eyebrow="Rescheduling payment" title="Complete the additional amount" description="Your original confirmed reservation remains valid until this additional payment is verified." />
      <Link className="inline-flex text-sm text-amber-200 hover:underline" href="/bookings">Back to my bookings</Link>
      <CustomerBankTransferDetails amountMinor={reschedule.additionalAmountDueMinor} reference={reschedule.additionalPayment.providerReference} statusLabel={reschedule.status.replaceAll("_", " ")} />
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><p className="text-xs uppercase tracking-[0.18em] text-stone-500">Original booking remains confirmed</p><h2 className="mt-2 text-xl font-semibold text-white">{reschedule.originalFacility.name}</h2><p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(reschedule.originalStartAtUtc, reschedule.originalEndAtUtc, reschedule.originalTimezone)}</p><p className="mt-4 text-sm text-stone-400">Original paid base amount</p><p className="text-2xl font-semibold text-white">{formatCurrency(reschedule.originalAmountMinor, "PHP")}</p></article>
        <article className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/5 p-6"><p className="text-xs uppercase tracking-[0.18em] text-amber-300">Replacement slot</p><h2 className="mt-2 text-xl font-semibold text-white">{reschedule.replacementFacility.name}</h2><p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(reschedule.replacementStartAtUtc, reschedule.replacementEndAtUtc, reschedule.replacementTimezone)}</p><p className="mt-4 text-sm text-stone-400">Additional amount due</p><p className="text-2xl font-semibold text-white">{formatCurrency(reschedule.additionalAmountDueMinor, "PHP")}</p>{reschedule.holdExpiresAt && canSubmit ? <p className="mt-2 text-sm text-amber-100">Replacement held for {formatDistanceToNowStrict(reschedule.holdExpiresAt)}.</p> : null}</article>
      </section>
      {reschedule.customerNote ? <section className="rounded-2xl border border-white/10 bg-stone-950/50 p-5 text-sm leading-7 text-amber-100">{reschedule.customerNote}</section> : null}
      {proofUrl ? <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><h2 className="text-lg font-semibold text-white">Submitted payment proof</h2><Link className="mt-4 block overflow-hidden rounded-2xl border border-white/10" href={proofUrl} target="_blank"><Image alt="Submitted additional payment proof" className="max-h-[520px] w-full object-contain" height={600} src={proofUrl} width={900} /></Link></section> : null}
      {canSubmit ? <ReschedulePaymentProofForm rescheduleId={reschedule.id} /> : <p className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-stone-300">Status: {reschedule.status.replaceAll("_", " ")}. {reschedule.additionalPayment.reviewNote ?? (reschedule.status === "EXPIRED" || reschedule.status === "REJECTED" ? "The original booking remains confirmed." : "Staff is reviewing your proof.")}</p>}
    </main>
  );
}
