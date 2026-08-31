import { BookingOrderStatus, BookingStatus, PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { activeBookingWhere } from "@/server/bookings/service";

describe("activeBookingWhere", () => {
  it("keeps paid and verified held records blocking availability", () => {
    const where = activeBookingWhere(new Date("2026-08-24T00:00:00.000Z"));
    const heldBranch = where.OR?.find((branch) => branch.status === BookingStatus.HELD);

    expect(heldBranch).toMatchObject({
      OR: expect.arrayContaining([
        { payment: { status: { in: expect.arrayContaining([PaymentStatus.PAID, PaymentStatus.VERIFIED]) } } }
      ])
    });
  });

  it("keeps active consolidated order children blocking availability", () => {
    const where = activeBookingWhere(new Date("2026-08-24T00:00:00.000Z"));
    const heldBranch = where.OR?.find((branch) => branch.status === BookingStatus.HELD);
    expect(heldBranch).toMatchObject({
      OR: expect.arrayContaining([
        { bookingOrder: { OR: expect.arrayContaining([{ status: BookingOrderStatus.PENDING_PAYMENT, paymentDeadline: { gt: expect.any(Date) }, payment: { status: PaymentStatus.AWAITING_PAYMENT } }]) } }
      ])
    });
  });

  it("keeps expired unpaid pending payments eligible for release", () => {
    const where = activeBookingWhere(new Date("2026-08-24T00:00:00.000Z"));
    const pendingBranch = where.OR?.find((branch) => branch.status === BookingStatus.PENDING_PAYMENT);

    expect(pendingBranch).toMatchObject({
      OR: expect.arrayContaining([
        { paymentHoldExpiresAt: { gt: expect.any(Date) } }
      ])
    });
  });
});
