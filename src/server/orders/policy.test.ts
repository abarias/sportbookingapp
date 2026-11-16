import { BookingOrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assertBookingOrderTransition, assertPaymentAllocationsReconcile } from "@/server/orders/policy";

describe("booking order policy", () => {
  it("allows the consolidated payment lifecycle", () => {
    expect(() => assertBookingOrderTransition(BookingOrderStatus.PENDING_PAYMENT, BookingOrderStatus.PROOF_SUBMITTED)).not.toThrow();
    expect(() => assertBookingOrderTransition(BookingOrderStatus.PROOF_SUBMITTED, BookingOrderStatus.CONFIRMED)).not.toThrow();
    expect(() => assertBookingOrderTransition(BookingOrderStatus.PROOF_SUBMITTED, BookingOrderStatus.ACTION_REQUIRED)).not.toThrow();
    expect(() => assertBookingOrderTransition(BookingOrderStatus.ACTION_REQUIRED, BookingOrderStatus.PROOF_SUBMITTED)).not.toThrow();
  });

  it("prevents partial or invalid terminal transitions", () => {
    expect(() => assertBookingOrderTransition(BookingOrderStatus.CONFIRMED, BookingOrderStatus.EXPIRED)).toThrow();
    expect(() => assertBookingOrderTransition(BookingOrderStatus.PENDING_PAYMENT, BookingOrderStatus.CONFIRMED)).toThrow();
  });

  it("requires payment allocations to reconcile exactly", () => {
    expect(assertPaymentAllocationsReconcile({ paymentAmountMinor: 300_000, orderAmountMinor: 300_000, bookingAmountsMinor: [100_000, 200_000] })).toBe(300_000);
    expect(() => assertPaymentAllocationsReconcile({ paymentAmountMinor: 299_999, orderAmountMinor: 300_000, bookingAmountsMinor: [100_000, 200_000] })).toThrow(/reconcile/);
  });
});
