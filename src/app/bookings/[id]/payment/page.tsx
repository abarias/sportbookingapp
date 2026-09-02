import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { PaymentProofForm } from "@/components/bookings/payment-proof-form";
import { PaymentHoldCountdown } from "@/components/bookings/payment-hold-countdown";
import { CustomerBankTransferDetails } from "@/components/payments/customer-bank-transfer-details";
import { SectionHeading } from "@/components/shared/section-heading";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { parsePriceSnapshot } from "@/server/pricing/snapshot";
import { expirePendingBookings } from "@/server/bookings/expiration";
import { minutesToTimeLabel } from "@/lib/time/slots";
import { formatDateTimeRange } from "@/lib/time/slots";

export const dynamic = "force-dynamic";

type PaymentPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
  }>;
};

function getPaymentLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    AWAITING_PAYMENT: "Reserved - Awaiting Payment",
    SUBMITTED: "Payment Submitted - For Verification",
    VERIFIED: "Booking Confirmed",
    REJECTED: "Payment Rejected",
    ACTION_REQUIRED: "Payment Needs Attention",
    PENDING: "Payment Pending",
    PAID: "Payment Recorded",
    FAILED: "Payment Failed",
    EXPIRED: "Reservation Expired",
    REFUNDED: "Payment Refunded"
  };

  return labels[status];
}

export default async function BookingPaymentPage({ params, searchParams }: PaymentPageProps) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const query = await searchParams;
  await expirePendingBookings({ batchSize: 100 });
  const booking = await prisma.booking.findFirst({
    where: {
      id,
      userId: session.user.id
    },
    include: {
      facility: { select: { name: true, timezone: true } },
      payment: true
    }
  });

  if (!booking || !booking.payment) {
    notFound();
  }

  const paymentProofUrl = await getPaymentProofUrl(booking.payment.proofImageUrl);
  const priceSnapshot = parsePriceSnapshot(booking.priceSnapshot);

  const now = new Date();
  const isAwaitingPayment = booking.payment.status === PaymentStatus.AWAITING_PAYMENT;
  const isExpiredHold =
    booking.paymentHoldExpiresAt &&
    booking.paymentHoldExpiresAt <= now &&
    (isAwaitingPayment || booking.payment.status === PaymentStatus.EXPIRED);
  const canSubmitProof =
    (booking.payment.status === PaymentStatus.AWAITING_PAYMENT || booking.payment.status === PaymentStatus.ACTION_REQUIRED) && !isExpiredHold;

  return (
    <main className="space-y-5 pb-16 sm:space-y-8">
      <SectionHeading
        compact
        eyebrow="Payment"
        title="Complete your payment"
        description="Your slot is held while payment is pending. Staff confirmation is required before the booking is final."
      />
      {query.submitted === "1" ? <p aria-live="polite" className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">Payment proof submitted successfully. Staff will verify your payment before confirming the booking.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-amber-100">Payment status: {getPaymentLabel(booking.payment.status)}</p>
        {booking.paymentHoldExpiresAt && isAwaitingPayment && !isExpiredHold ? (
          <PaymentHoldCountdown deadlineLabel={formatInTimeZone(booking.paymentHoldExpiresAt, booking.timezone, "h:mm a")} expiresAt={booking.paymentHoldExpiresAt.toISOString()} initialRemainingMs={booking.paymentHoldExpiresAt.getTime() - now.getTime()} />
        ) : isExpiredHold ? (
          <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm font-medium leading-6 text-rose-100">
            This unpaid reservation hold has expired. Please create a new booking. If bank transfer has already been made, please contact MMG Stellar Admin.
          </p>
        ) : null}
      </div>

      <section className="space-y-5 sm:space-y-6">
        <CustomerBankTransferDetails amountMinor={booking.amountMinor} reference={booking.payment.providerReference ?? "Booking payment"} showStatus={false} statusLabel={getPaymentLabel(booking.payment.status)} />
        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 sm:space-y-5 sm:p-6">
          <div>
            <h1 className="mt-1 text-lg font-semibold text-white">{booking.facility.name}</h1>
            <p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
          </div>
          {priceSnapshot?.segments.length ? (
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Base price breakdown</p>
              <div className="mt-3 space-y-2">
                {priceSnapshot.segments.map((segment) => (
                  <div key={`${segment.startMinutes}-${segment.ruleId}`} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-stone-300">{minutesToTimeLabel(segment.startMinutes)}-{minutesToTimeLabel(segment.endMinutes)} · {segment.rateLabel}</span>
                    <span className="font-medium text-white">{formatCurrency(segment.amountMinor, "PHP")}</span>
                  </div>
                ))}
              </div>
              {priceSnapshot.holidayName ? <p className="mt-3 text-sm text-amber-200">Holiday pricing: {priceSnapshot.holidayName}</p> : null}
            </div>
          ) : null}
          {booking.payment.reviewNote ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
              <p className="font-medium text-white">Staff message</p>
              <p>{booking.payment.reviewNote}</p>
            </div>
          ) : null}
          {paymentProofUrl ? (
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">Uploaded payment proof</p>
                {booking.payment.submittedAt ? (
                  <p className="text-xs text-stone-400">
                    Uploaded {formatInTimeZone(booking.payment.submittedAt, booking.timezone, "MMM d, h:mm a")}
                  </p>
                ) : null}
              </div>
              <a
                className="mt-3 block overflow-hidden rounded-xl border border-white/10"
                href={paymentProofUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Image
                  src={paymentProofUrl}
                  alt="Uploaded payment receipt"
                  width={900}
                  height={600}
                  className="max-h-[520px] w-full object-contain"
                />
              </a>
              <p className="mt-2 text-xs text-stone-400">Click the image to view it at full size.</p>
            </div>
          ) : null}
        </div>

        {canSubmitProof ? <PaymentProofForm bookingId={booking.id} /> : null}
      </section>
    </main>
  );
}
