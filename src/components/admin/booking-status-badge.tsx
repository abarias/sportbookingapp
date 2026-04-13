import { BookingStatus, PaymentStatus } from "@prisma/client";

type BookingStatusBadgeProps = {
  bookingStatus: BookingStatus;
  paymentStatus?: PaymentStatus | null;
};

const bookingTone: Record<BookingStatus, string> = {
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

export function BookingStatusBadge({ bookingStatus, paymentStatus }: BookingStatusBadgeProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${bookingTone[bookingStatus]}`}>
        {bookingStatus.replaceAll("_", " ")}
      </span>
      {paymentStatus ? (
        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${paymentTone[paymentStatus]}`}>
          Payment {paymentStatus}
        </span>
      ) : null}
    </div>
  );
}
