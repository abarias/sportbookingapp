import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingOrderStatus, PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { PaymentHoldCountdown } from "@/components/bookings/payment-hold-countdown";
import { OrderPaymentProofForm } from "@/components/orders/order-payment-proof-form";
import { CustomerBankTransferDetails } from "@/components/payments/customer-bank-transfer-details";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireUserSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange } from "@/lib/time/slots";
import { expirePendingOrders } from "@/server/orders/expiration";
import { getCustomerOrder } from "@/server/orders/service";

export const dynamic = "force-dynamic";

const statusLabels: Record<BookingOrderStatus, string> = {
  PENDING_PAYMENT: "Reserved - Awaiting Consolidated Payment",
  PROOF_SUBMITTED: "Payment Submitted - For Verification",
  ACTION_REQUIRED: "Payment Needs Attention",
  CONFIRMED: "All Initial Bookings Confirmed",
  PAYMENT_REJECTED: "Payment Rejected",
  EXPIRED: "Order Expired",
  CANCELLED: "Order Cancelled"
};

export default async function OrderPaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; submitted?: string }> }) {
  const session = await requireUserSession();
  await expirePendingOrders({ batchSize: 50 });
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getCustomerOrder(session.user.id, id);
  if (!order?.payment) notFound();

  const now = new Date();
  const expired = order.status === BookingOrderStatus.EXPIRED || (order.status === BookingOrderStatus.PENDING_PAYMENT && Boolean(order.paymentDeadline && order.paymentDeadline <= now));
  const canSubmit = !expired && (order.payment.status === PaymentStatus.AWAITING_PAYMENT || order.payment.status === PaymentStatus.ACTION_REQUIRED);
  const proofUrl = await getPaymentProofUrl(order.payment.proofImageUrl);

  return (
    <main className="space-y-5 pb-16 sm:space-y-8">
      <SectionHeading compact eyebrow="Consolidated payment" title="Complete one payment for every schedule." description="All included slots are held together while payment is pending. Staff verification confirms the complete initial order." />
      {query.created === "1" ? <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">Checkout completed. All listed schedules are temporarily held until the payment deadline.</p> : null}
      {query.submitted === "1" ? <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">Payment proof submitted successfully. Staff will verify the consolidated payment before confirming the bookings.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-amber-100">Payment status: {statusLabels[order.status]}</p>
        {order.paymentDeadline && order.status === BookingOrderStatus.PENDING_PAYMENT && !expired ? (
          <PaymentHoldCountdown expiresAt={order.paymentDeadline.toISOString()} deadlineLabel={formatInTimeZone(order.paymentDeadline, "Asia/Manila", "MMM d, h:mm a")} initialRemainingMs={order.paymentDeadline.getTime() - now.getTime()} />
        ) : expired ? (
          <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm font-medium leading-6 text-rose-100">This consolidated hold expired and all included schedules were released. If bank transfer has been made, please contact MMG Stellar Admin.</p>
        ) : null}
      </div>

      <section className="space-y-5 sm:space-y-6">
        <CustomerBankTransferDetails amountMinor={order.baseAmountMinor} reference={order.reference} showStatus={false} statusLabel={statusLabels[order.status]} />
        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 sm:space-y-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-lg font-semibold text-white">Order {order.reference}</h1><p className="mt-1 text-sm text-stone-300">{order.bookings.length} individually traceable booking{order.bookings.length === 1 ? "" : "s"}</p></div><Link className="text-sm text-amber-200 hover:underline" href={`/orders/${order.id}`}>View order details</Link></div>
          <div className="grid gap-3 sm:grid-cols-2">{order.bookings.map((booking) => <article key={booking.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">{booking.reference}</p><h2 className="mt-2 font-medium text-white">{booking.facility.name}</h2><p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p><p className="mt-2 text-sm font-medium text-amber-100">{formatCurrency(booking.amountMinor, "PHP")} VAT exclusive</p></article>)}</div>
          {order.payment.reviewNote ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><p className="font-medium text-white">Staff message</p><p>{order.payment.reviewNote}</p></div> : null}
          {proofUrl ? <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4"><div className="flex justify-between gap-3"><p className="font-medium text-white">Uploaded consolidated proof</p>{order.payment.submittedAt ? <p className="text-xs text-stone-400">Uploaded {formatInTimeZone(order.payment.submittedAt, "Asia/Manila", "MMM d, h:mm a")}</p> : null}</div><a className="mt-3 block overflow-hidden rounded-xl border border-white/10" href={proofUrl} rel="noreferrer" target="_blank"><Image alt="Uploaded consolidated payment receipt" className="max-h-[520px] w-full object-contain" height={600} src={proofUrl} width={900} /></a></div> : null}
        </div>
        {canSubmit ? <OrderPaymentProofForm bookingOrderId={order.id} /> : null}
      </section>
    </main>
  );
}
