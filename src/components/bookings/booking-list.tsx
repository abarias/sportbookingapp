import { BookingRescheduleStatus, PaymentStatus } from "@prisma/client";
import { BookingStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { formatInTimeZone } from "date-fns-tz";

type BookingListItem = {
  id: string;
  facilityName: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  amountMinor: number;
  currency: "PHP";
  startAtUtc: Date;
  endAtUtc: Date;
  timezone: string;
  paymentHoldExpiresAt: Date | null;
  paymentReviewNote: string | null;
  isCancellable: boolean;
  reschedules: Array<{
    id: string;
    status: BookingRescheduleStatus;
    adjustmentStatus: string;
    originalFacility: { name: string };
    replacementFacility: { name: string };
    originalStartAtUtc: Date;
    originalEndAtUtc: Date;
    originalTimezone: string;
    replacementStartAtUtc: Date;
    replacementEndAtUtc: Date;
    replacementTimezone: string;
    originalAmountMinor: number;
    replacementAmountMinor: number;
    priceDifferenceMinor: number;
    additionalAmountDueMinor: number;
    holdExpiresAt: Date | null;
    reason: string;
    customerNote: string | null;
    createdAt: Date;
    additionalPayment: { status: PaymentStatus; reviewNote: string | null } | null;
  }>;
};

type BookingListProps = {
  title: string;
  items: BookingListItem[];
  emptyMessage: string;
  footer?: ReactNode;
};

const statusTone: Record<BookingStatus, string> = {
  HELD: "bg-amber-400/15 text-amber-100",
  PENDING_PAYMENT: "bg-amber-400/15 text-amber-100",
  CONFIRMED: "bg-emerald-400/15 text-emerald-100",
  CANCELLED: "bg-stone-600/30 text-stone-200",
  EXPIRED: "bg-rose-400/15 text-rose-100"
};

const paymentTone: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "bg-amber-400/15 text-amber-100",
  SUBMITTED: "bg-sky-400/15 text-sky-100",
  VERIFIED: "bg-emerald-400/15 text-emerald-100",
  REJECTED: "bg-rose-400/15 text-rose-100",
  ACTION_REQUIRED: "bg-orange-400/15 text-orange-100",
  PENDING: "bg-amber-400/15 text-amber-100",
  PAID: "bg-emerald-400/15 text-emerald-100",
  FAILED: "bg-rose-400/15 text-rose-100",
  EXPIRED: "bg-stone-600/30 text-stone-200",
  REFUNDED: "bg-sky-400/15 text-sky-100"
};

const bookingLabels: Record<BookingStatus, string> = {
  HELD: "Reserved",
  PENDING_PAYMENT: "Reserved",
  CONFIRMED: "Booking Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Reservation Expired"
};

const paymentLabels: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  SUBMITTED: "Payment Submitted - For Verification",
  VERIFIED: "Payment Verified",
  REJECTED: "Payment Rejected",
  ACTION_REQUIRED: "Payment Needs Attention",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded"
};

export function BookingList({ title, items, emptyMessage, footer }: BookingListProps) {
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-stone-400">{emptyMessage}</p> : null}
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-base font-semibold text-white">{item.facilityName}</p>
                <p className="text-sm text-stone-300">{formatDateTimeRange(item.startAtUtc, item.endAtUtc, item.timezone)}</p>
                <p className="text-sm text-stone-400">Base amount: {formatCurrency(item.amountMinor, item.currency)} <span className="text-stone-500">(VAT exclusive)</span></p>
                {item.paymentStatus ? (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${paymentTone[item.paymentStatus]}`}>
                    {paymentLabels[item.paymentStatus]}
                  </span>
                ) : null}
                {item.paymentHoldExpiresAt && item.status === BookingStatus.EXPIRED ? (
                  <p className="text-sm text-rose-200">
                    Payment hold expired at {formatInTimeZone(item.paymentHoldExpiresAt, item.timezone, "MMM d, yyyy h:mm a")}
                  </p>
                ) : null}
                {(item.status === BookingStatus.PENDING_PAYMENT || item.status === BookingStatus.HELD) && item.paymentHoldExpiresAt ? (
                  <p className="text-sm text-amber-200">
                    Payment hold expires at {formatInTimeZone(item.paymentHoldExpiresAt, item.timezone, "h:mm a")}
                  </p>
                ) : null}
                {item.status === BookingStatus.HELD &&
                item.paymentStatus &&
                (item.paymentStatus === PaymentStatus.AWAITING_PAYMENT ||
                  item.paymentStatus === PaymentStatus.ACTION_REQUIRED ||
                  item.paymentStatus === PaymentStatus.SUBMITTED) ? (
                  <Link className="inline-flex text-sm font-medium text-amber-200 underline-offset-4 hover:underline" href={`/bookings/${item.id}/payment`}>
                    View payment instructions
                  </Link>
                ) : null}
                {item.paymentReviewNote ? (
                  <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
                    Staff message: {item.paymentReviewNote}
                  </p>
                ) : null}
                {item.reschedules.length ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white">Rescheduling history</p>
                    {item.reschedules.map((reschedule) => (
                      <div key={reschedule.id} className="border-t border-white/10 pt-3 first:border-0 first:pt-0">
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-stone-200">{reschedule.originalFacility.name} → {reschedule.replacementFacility.name}</p><span className="text-xs uppercase tracking-[0.14em] text-amber-200">{reschedule.status.replaceAll("_", " ")}</span></div>
                        <p className="mt-1 text-xs text-stone-400">Previous: {formatDateTimeRange(reschedule.originalStartAtUtc, reschedule.originalEndAtUtc, reschedule.originalTimezone)}</p>
                        <p className="mt-1 text-xs text-stone-300">Replacement: {formatDateTimeRange(reschedule.replacementStartAtUtc, reschedule.replacementEndAtUtc, reschedule.replacementTimezone)}</p>
                        <p className="mt-2 text-xs text-stone-400">Base price: {formatCurrency(reschedule.originalAmountMinor, "PHP")} → {formatCurrency(reschedule.replacementAmountMinor, "PHP")}</p>
                        <p className="mt-1 text-xs text-stone-400">Reason: {reschedule.reason}</p>
                        {reschedule.customerNote ? <p className="mt-1 text-xs text-amber-100">Staff note: {reschedule.customerNote}</p> : null}
                        {reschedule.status === BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED ? <Link className="mt-2 inline-flex text-sm font-medium text-amber-200 hover:underline" href={`/bookings/${item.id}/reschedule-payment`}>Pay additional {formatCurrency(reschedule.additionalAmountDueMinor, "PHP")}</Link> : null}
                        {reschedule.status === BookingRescheduleStatus.PAYMENT_SUBMITTED ? <p className="mt-2 text-sm text-sky-200">Additional payment submitted for verification. Your original booking remains valid.</p> : null}
                        {(reschedule.status === BookingRescheduleStatus.REJECTED || reschedule.status === BookingRescheduleStatus.EXPIRED) ? <p className="mt-2 text-sm text-stone-300">This attempt did not change your confirmed booking.</p> : null}
                        {reschedule.additionalPayment?.reviewNote ? <p className="mt-2 text-sm text-amber-100">Staff message: {reschedule.additionalPayment.reviewNote}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {item.isCancellable ? (
                  <div className="pt-1">
                    <CancelBookingButton bookingId={item.id} />
                  </div>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusTone[item.status]}`}>
                {bookingLabels[item.status]}
              </span>
            </div>
          </article>
        ))}
      </div>
      {footer}
    </section>
  );
}
