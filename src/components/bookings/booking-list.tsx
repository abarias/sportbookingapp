import { PaymentStatus } from "@prisma/client";
import { BookingStatus } from "@prisma/client";

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
  isCancellable: boolean;
};

type BookingListProps = {
  title: string;
  items: BookingListItem[];
  emptyMessage: string;
};

const statusTone: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-amber-400/15 text-amber-100",
  CONFIRMED: "bg-emerald-400/15 text-emerald-100",
  CANCELLED: "bg-stone-600/30 text-stone-200",
  EXPIRED: "bg-rose-400/15 text-rose-100"
};

const paymentTone: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-400/15 text-amber-100",
  PAID: "bg-emerald-400/15 text-emerald-100",
  FAILED: "bg-rose-400/15 text-rose-100",
  EXPIRED: "bg-stone-600/30 text-stone-200",
  REFUNDED: "bg-sky-400/15 text-sky-100"
};

export function BookingList({ title, items, emptyMessage }: BookingListProps) {
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
                <p className="text-sm text-stone-400">{formatCurrency(item.amountMinor, item.currency)}</p>
                {item.paymentStatus ? (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${paymentTone[item.paymentStatus]}`}>
                    Payment {item.paymentStatus}
                  </span>
                ) : null}
                {item.status === BookingStatus.PENDING_PAYMENT && item.paymentHoldExpiresAt ? (
                  <p className="text-sm text-amber-200">
                    Payment hold expires at {formatInTimeZone(item.paymentHoldExpiresAt, item.timezone, "h:mm a")}
                  </p>
                ) : null}
                {item.isCancellable ? (
                  <div className="pt-1">
                    <CancelBookingButton bookingId={item.id} />
                  </div>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusTone[item.status]}`}>
                {item.status.replaceAll("_", " ")}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
