import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PaymentStatus } from "@prisma/client";
import { formatDistanceToNowStrict } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { PaymentProofForm } from "@/components/bookings/payment-proof-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange } from "@/lib/time/slots";

export const dynamic = "force-dynamic";

type PaymentPageProps = {
  params: Promise<{
    id: string;
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

export default async function BookingPaymentPage({ params }: PaymentPageProps) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
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

  const now = new Date();
  const isAwaitingPayment = booking.payment.status === PaymentStatus.AWAITING_PAYMENT;
  const isExpiredHold =
    booking.paymentHoldExpiresAt &&
    booking.paymentHoldExpiresAt <= now &&
    (isAwaitingPayment || booking.payment.status === PaymentStatus.EXPIRED);
  const canSubmitProof =
    (booking.payment.status === PaymentStatus.AWAITING_PAYMENT || booking.payment.status === PaymentStatus.ACTION_REQUIRED) && !isExpiredHold;

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Payment"
        title="Complete your reservation payment"
        description="Your slot is held while payment is pending. Staff confirmation is required before the booking is final."
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">{getPaymentLabel(booking.payment.status)}</p>
            <h1 className="mt-3 font-serif text-3xl text-white">{booking.facility.name}</h1>
            <p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
          </div>
          <div className="grid gap-3 text-sm text-stone-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <p className="text-stone-500">Reference</p>
              <p className="mt-1 text-lg font-semibold text-white">{booking.payment.providerReference}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <p className="text-stone-500">Amount due</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(booking.amountMinor, "PHP")}</p>
            </div>
          </div>
          {booking.paymentHoldExpiresAt && isAwaitingPayment && !isExpiredHold ? (
            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              Reserved for you for {formatDistanceToNowStrict(booking.paymentHoldExpiresAt)}. Submit payment proof before{" "}
              {formatInTimeZone(booking.paymentHoldExpiresAt, booking.timezone, "h:mm a")}.
            </p>
          ) : null}
          {isExpiredHold ? (
            <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              This unpaid reservation hold has expired. Please create a new booking. If payment has already been made, please contact MMG Stellar support.
            </p>
          ) : null}
          {booking.payment.reviewNote ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
              <p className="font-medium text-white">Staff message</p>
              <p>{booking.payment.reviewNote}</p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
            <p className="font-medium text-white">Payment instructions</p>
            <p>GCash: 0917 000 0000 - MMG Stellar</p>
            <p>Bank transfer: BPI 0000-0000-00 - MMG Stellar</p>
            <p>Include booking reference {booking.payment.providerReference} in the transfer remarks when possible.</p>
          </div>
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

        {canSubmitProof ? (
          <PaymentProofForm bookingId={booking.id} />
        ) : (
          <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-stone-300">
            <h2 className="text-lg font-semibold text-white">Payment status</h2>
            <p className="mt-2">{getPaymentLabel(booking.payment.status)}</p>
          </section>
        )}
      </section>
    </main>
  );
}
