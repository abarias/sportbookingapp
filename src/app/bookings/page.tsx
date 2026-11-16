import { BookingRescheduleStatus, BookingStatus, PaymentStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BookingHistoryPagination } from "@/components/bookings/booking-history-pagination";
import { BookingList } from "@/components/bookings/booking-list";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { expirePendingBookings } from "@/server/bookings/expiration";
import { expirePendingReschedules } from "@/server/bookings/rescheduling";
import { expirePendingOrders } from "@/server/orders/expiration";
import { canCustomerCancelBooking, resolveCancellationEnabled, resolveCancellationWindowHours } from "@/server/bookings/policies";

export const dynamic = "force-dynamic";

type BookingsPageProps = {
  searchParams: Promise<{
    created?: string;
    mockPaid?: string;
    cancelled?: string;
    historyPage?: string;
    historyPageSize?: string;
  }>;
};

type CustomerBookingListRecord = Awaited<ReturnType<typeof prisma.booking.findMany>>[number] & {
  payment: {
    status: PaymentStatus;
    reviewNote: string | null;
  } | null;
  bookingOrder: {
    id: string;
    reference: string;
    status: string;
    payment: {
      status: PaymentStatus;
      reviewNote: string | null;
    } | null;
  } | null;
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

function needsCustomerPaymentAction(booking: CustomerBookingListRecord) {
  const paymentStatus = booking.payment?.status ?? booking.bookingOrder?.payment?.status;
  return (
    booking.status === BookingStatus.HELD &&
    (paymentStatus === PaymentStatus.AWAITING_PAYMENT || paymentStatus === PaymentStatus.ACTION_REQUIRED)
  ) || booking.reschedules.some((reschedule) => reschedule.status === BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED);
}

function sortUpcomingBookings(left: CustomerBookingListRecord, right: CustomerBookingListRecord) {
  const leftNeedsAction = needsCustomerPaymentAction(left);
  const rightNeedsAction = needsCustomerPaymentAction(right);

  if (leftNeedsAction !== rightNeedsAction) {
    return leftNeedsAction ? -1 : 1;
  }

  return left.startAtUtc.getTime() - right.startAtUtc.getTime();
}

function paymentStatusFor(booking: CustomerBookingListRecord) {
  return booking.payment?.status ?? booking.bookingOrder?.payment?.status ?? null;
}

function paymentReviewNoteFor(booking: CustomerBookingListRecord) {
  return booking.payment?.reviewNote ?? booking.bookingOrder?.payment?.reviewNote ?? null;
}

const HISTORY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseHistoryPageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value, HISTORY_PAGE_SIZE_OPTIONS[0]);
  return HISTORY_PAGE_SIZE_OPTIONS.includes(parsed as (typeof HISTORY_PAGE_SIZE_OPTIONS)[number]) ? parsed : HISTORY_PAGE_SIZE_OPTIONS[0];
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const session = await getSession();
  const params = await searchParams;

  if (!session?.user) {
    return (
      <main className="space-y-8 pb-16">
        <SectionHeading
          eyebrow="Customer"
          title="My bookings"
          description="Sign in to view upcoming bookings, booking history, payment status, and cancellations."
        />
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-stone-300">
          <p className="mb-4">This section becomes your booking timeline after customer sign-in.</p>
          <Button asChild>
            <Link href="/login?callbackUrl=/bookings">Sign in to continue</Link>
          </Button>
        </section>
      </main>
    );
  }

  const now = new Date();
  await Promise.all([
    expirePendingBookings({ now }),
    expirePendingReschedules({ now }),
    expirePendingOrders({ now })
  ]);
  const historyPage = parsePositiveInteger(params.historyPage, 1);
  const historyPageSize = parseHistoryPageSize(params.historyPageSize);
  const historyWhere = {
    userId: session.user.id,
    OR: [
      { endAtUtc: { lt: now } },
      { status: BookingStatus.CANCELLED },
      { status: BookingStatus.EXPIRED },
      { payment: { is: { status: PaymentStatus.REJECTED } } }
    ]
  };
  const bookingInclude = {
    facility: {
      select: {
        name: true,
        cancellationEnabledOverride: true,
        cancellationWindowHoursOverride: true
      }
    },
    payment: {
      select: {
        status: true,
        reviewNote: true
      }
    },
    bookingOrder: {
      select: {
        id: true,
        reference: true,
        status: true,
        payment: {
          select: {
            status: true,
            reviewNote: true
          }
        }
      }
    },
    reschedules: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        adjustmentStatus: true,
        originalFacility: { select: { name: true } },
        replacementFacility: { select: { name: true } },
        originalStartAtUtc: true,
        originalEndAtUtc: true,
        originalTimezone: true,
        replacementStartAtUtc: true,
        replacementEndAtUtc: true,
        replacementTimezone: true,
        originalAmountMinor: true,
        replacementAmountMinor: true,
        priceDifferenceMinor: true,
        additionalAmountDueMinor: true,
        holdExpiresAt: true,
        reason: true,
        customerNote: true,
        createdAt: true,
        additionalPayment: { select: { status: true, reviewNote: true } }
      }
    }
  } as const;

  const [upcomingBookings, history, historyTotalCount, cancellationSetting, cancellationWindowSetting] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId: session.user.id,
        endAtUtc: { gte: now },
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.EXPIRED] },
        OR: [
          { payment: { isNot: { status: PaymentStatus.REJECTED } } },
          { bookingOrder: { payment: { isNot: { status: PaymentStatus.REJECTED } } } }
        ]
      },
      orderBy: {
        startAtUtc: "asc"
      },
      include: bookingInclude
    }),
    prisma.booking.findMany({
      where: historyWhere,
      orderBy: {
        startAtUtc: "desc"
      },
      skip: (historyPage - 1) * historyPageSize,
      take: historyPageSize,
      include: bookingInclude
    }),
    prisma.booking.count({ where: historyWhere }),
    prisma.appSetting.findUnique({
      where: { key: "booking.cancellationWindowHours" }
    }),
    prisma.appSetting.findUnique({
      where: { key: "booking.cancellationEnabled" }
    })
  ]);

  const globalCancellationEnabled = cancellationWindowSetting?.value === true;
  const globalCancellationWindowHours = typeof cancellationSetting?.value === "number" ? cancellationSetting.value : 24;

  const upcoming = upcomingBookings.sort(sortUpcomingBookings);
  const totalHistoryPages = Math.max(1, Math.ceil(historyTotalCount / historyPageSize));

  if (historyPage > totalHistoryPages) {
    redirect(`/bookings?historyPage=${totalHistoryPages}&historyPageSize=${historyPageSize}`);
  }

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Customer"
        title="My bookings"
        description="Track upcoming reservations, payment status, and past visits in one place."
      />
      {params.created === "1" ? (
        <section className="rounded-[1.75rem] border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {params.mockPaid === "1"
            ? "Your reservation is confirmed and your payment has been recorded."
            : "Booking created successfully."}
        </section>
      ) : null}
      {params.cancelled === "1" ? (
        <section aria-live="polite" className="rounded-[1.75rem] border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          Booking cancelled successfully. Any refund handling will be coordinated by staff.
        </section>
      ) : null}
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-stone-300">
        <p className="mb-3">Signed in as {session.user.email}</p>
        <p>Use this page to review upcoming reservations, cancellation eligibility, and your booking history.</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <BookingList
          emptyMessage="No upcoming bookings yet. Start from the facilities page to reserve an open slot."
          items={upcoming.map((booking) => ({
            id: booking.id,
            facilityName: booking.facility.name,
            orderReference: booking.bookingOrder?.reference ?? null,
            orderId: booking.bookingOrder?.id ?? null,
            status: booking.status,
            paymentStatus: paymentStatusFor(booking),
            amountMinor: booking.amountMinor,
            currency: "PHP",
            startAtUtc: booking.startAtUtc,
            endAtUtc: booking.endAtUtc,
            timezone: booking.timezone,
            paymentHoldExpiresAt: booking.paymentHoldExpiresAt,
            paymentReviewNote: paymentReviewNoteFor(booking),
            isCancellable: !booking.reschedules.some((reschedule) =>
              reschedule.status === BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED ||
              reschedule.status === BookingRescheduleStatus.PAYMENT_SUBMITTED
            ) && canCustomerCancelBooking({
              bookingStatus: booking.status,
              startAtUtc: booking.startAtUtc,
              createdAt: booking.createdAt,
              now,
              cancellationEnabled: resolveCancellationEnabled(globalCancellationEnabled, booking.facility.cancellationEnabledOverride),
              cancellationWindowHours: resolveCancellationWindowHours(
                globalCancellationWindowHours,
                booking.facility.cancellationWindowHoursOverride
              )
            }),
            reschedules: booking.reschedules
          }))}
          title="Upcoming"
        />
        <BookingList
          emptyMessage="No booking history yet."
          items={history.map((booking) => ({
            id: booking.id,
            facilityName: booking.facility.name,
            orderReference: booking.bookingOrder?.reference ?? null,
            orderId: booking.bookingOrder?.id ?? null,
            status: booking.status,
            paymentStatus: paymentStatusFor(booking),
            amountMinor: booking.amountMinor,
            currency: "PHP",
            startAtUtc: booking.startAtUtc,
            endAtUtc: booking.endAtUtc,
            timezone: booking.timezone,
            paymentHoldExpiresAt: booking.paymentHoldExpiresAt,
            paymentReviewNote: paymentReviewNoteFor(booking),
            isCancellable: false,
            reschedules: booking.reschedules
          }))}
          title="History"
          footer={
            historyTotalCount > 0 ? (
              <BookingHistoryPagination page={historyPage} pageSize={historyPageSize} totalCount={historyTotalCount} />
            ) : null
          }
        />
      </div>
    </main>
  );
}
