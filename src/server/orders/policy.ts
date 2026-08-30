import { BookingOrderStatus } from "@prisma/client";

const validTransitions: Readonly<Record<BookingOrderStatus, readonly BookingOrderStatus[]>> = {
  PENDING_PAYMENT: [BookingOrderStatus.PROOF_SUBMITTED, BookingOrderStatus.EXPIRED, BookingOrderStatus.CANCELLED],
  PROOF_SUBMITTED: [BookingOrderStatus.CONFIRMED, BookingOrderStatus.PAYMENT_REJECTED, BookingOrderStatus.ACTION_REQUIRED],
  ACTION_REQUIRED: [BookingOrderStatus.PROOF_SUBMITTED, BookingOrderStatus.PAYMENT_REJECTED, BookingOrderStatus.CANCELLED],
  CONFIRMED: [],
  PAYMENT_REJECTED: [],
  EXPIRED: [],
  CANCELLED: []
};

export function assertBookingOrderTransition(from: BookingOrderStatus, to: BookingOrderStatus) {
  if (!validTransitions[from].includes(to)) {
    throw new Error(`Booking order cannot transition from ${from} to ${to}.`);
  }
}

export function assertPaymentAllocationsReconcile(input: {
  paymentAmountMinor: number;
  orderAmountMinor: number;
  bookingAmountsMinor: number[];
}) {
  const allocationTotal = input.bookingAmountsMinor.reduce((sum, amount) => sum + amount, 0);
  if (allocationTotal !== input.paymentAmountMinor || allocationTotal !== input.orderAmountMinor) {
    throw new Error("Order payment allocations do not reconcile with the checkout amount.");
  }
  return allocationTotal;
}
