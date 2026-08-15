import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { PaymentReviewForm } from "@/components/admin/payment-review-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminPaymentDetailData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

type AdminPaymentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const paymentLabels: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  SUBMITTED: "For Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ACTION_REQUIRED: "Action Required",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded"
};

export default async function AdminPaymentDetailPage({ params }: AdminPaymentDetailPageProps) {
  await requireAdminSession();
  const { id } = await params;
  const payment = await getAdminPaymentDetailData(id);

  if (!payment) {
    notFound();
  }

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Payment review"
        description="Compare submitted proof against the actual payment account before confirming the booking."
      />
      <AdminNav current="payments" />
      <Link className="inline-flex text-sm font-medium text-amber-200 underline-offset-4 hover:underline" href="/admin/payments">
        Back to payment queue
      </Link>

      <article className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-amber-300">{paymentLabels[payment.status]}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{payment.booking.facility.name}</h2>
              <p className="mt-1 text-sm text-stone-300">
                {formatDateTimeRange(payment.booking.startAtUtc, payment.booking.endAtUtc, payment.booking.timezone)}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
              {payment.providerReference}
            </span>
          </div>

          <div className="grid gap-3 text-sm text-stone-300 md:grid-cols-2">
            <p><span className="text-stone-500">Customer:</span> {payment.booking.user.fullName}</p>
            <p><span className="text-stone-500">Email:</span> {payment.booking.user.email}</p>
            <p><span className="text-stone-500">Phone:</span> {payment.booking.user.phone ?? "Not provided"}</p>
            <p><span className="text-stone-500">Expected:</span> {formatCurrency(payment.amountMinor, "PHP")}</p>
            <p><span className="text-stone-500">Claimed:</span> {formatCurrency(payment.amountPaidMinor ?? 0, "PHP")}</p>
            <p><span className="text-stone-500">Method:</span> {payment.method?.replaceAll("_", " ") ?? "Not set"}</p>
            <p><span className="text-stone-500">Transfer ref:</span> {payment.externalReference ?? "Not set"}</p>
            <p>
              <span className="text-stone-500">Submitted:</span>{" "}
              {payment.submittedAt ? formatInTimeZone(payment.submittedAt, payment.booking.timezone, "MMM d, h:mm a") : "Not submitted"}
            </p>
          </div>

          {payment.duplicateReference ? (
            <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
              Possible duplicate transfer reference. Verify carefully against the payment account.
            </p>
          ) : null}

          {payment.reviewNote ? (
            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              Staff note: {payment.reviewNote}
            </p>
          ) : null}

          {payment.proofImageUrl ? (
            <Link href={payment.proofImageUrl} target="_blank" className="block overflow-hidden rounded-2xl border border-white/10">
              <Image src={payment.proofImageUrl} alt="Payment proof" width={900} height={600} className="max-h-[520px] w-full object-contain" />
            </Link>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-400">No proof image uploaded.</p>
          )}
        </div>

        {payment.status === PaymentStatus.SUBMITTED ? (
          <PaymentReviewForm paymentId={payment.id} />
        ) : (
          <section className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
            <p className="font-medium text-white">Current status</p>
            <p>{paymentLabels[payment.status]}</p>
            {payment.verifiedBy ? <p>Last reviewed by {payment.verifiedBy.fullName}</p> : null}
          </section>
        )}
      </article>
    </main>
  );
}
