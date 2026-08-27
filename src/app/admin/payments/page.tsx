import { PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PaymentQueuePagination } from "@/components/admin/payment-queue-pagination";
import { PaymentQueueTable, type PaymentQueueRow } from "@/components/admin/payment-queue-table";
import { DashboardStat } from "@/components/shared/dashboard-stat";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminPaymentQueueData, getReschedulePaymentQueueData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

const paymentLabels: Record<PaymentStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  SUBMITTED: "For Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ACTION_REQUIRED: "Action Required",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded"
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

function formatPaymentMethod(method: string | null) {
  return method ? method.replaceAll("_", " ") : "Not set";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type AdminPaymentsPageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    reschedulePage?: string;
    reschedulePageSize?: string;
  }>;
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value, PAGE_SIZE_OPTIONS[0]);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : PAGE_SIZE_OPTIONS[0];
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  await requirePermission("payments.view");
  const params = await searchParams;
  const page = parsePositiveInteger(params.page, 1);
  const pageSize = parsePageSize(params.pageSize);
  const reschedulePage = parsePositiveInteger(params.reschedulePage, 1);
  const reschedulePageSize = parsePageSize(params.reschedulePageSize);
  const [{ payments, totalCount, submittedCount, actionRequiredCount, duplicateCount }, rescheduleQueue] = await Promise.all([
    getAdminPaymentQueueData({ page, pageSize }),
    getReschedulePaymentQueueData({ page: reschedulePage, pageSize: reschedulePageSize })
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rescheduleTotalPages = Math.max(1, Math.ceil(rescheduleQueue.totalCount / reschedulePageSize));

  if (page > totalPages) {
    redirect(`/admin/payments?page=${totalPages}&pageSize=${pageSize}`);
  }
  if (reschedulePage > rescheduleTotalPages) {
    const next = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      reschedulePage: String(rescheduleTotalPages),
      reschedulePageSize: String(reschedulePageSize)
    });
    redirect(`/admin/payments?${next.toString()}`);
  }

  const rows: PaymentQueueRow[] = payments.map((payment) => {
    const order = payment.bookingOrder;
    const booking = payment.booking;
    const customer = order?.user ?? booking?.user;
    const firstOrderBooking = order?.bookings[0];
    const timezone = firstOrderBooking?.timezone ?? booking?.timezone ?? "Asia/Manila";
    const schedule = order
      ? `${order.bookings.length} bookings in consolidated order`
      : booking
        ? formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)
        : "Booking unavailable";
    const facilityName = order
      ? order.bookings.map((item) => item.facility.name).filter((name, index, names) => names.indexOf(name) === index).join(", ")
      : booking?.facility.name ?? "Unknown facility";

    return {
      id: payment.id,
      customerName: customer?.fullName ?? "Unknown customer",
      customerContact: customer?.phone ?? customer?.email ?? "Contact unavailable",
      schedule,
      facilityName,
      amountDue: formatCurrency(payment.amountMinor, "PHP"),
      bookingReference: order?.reference ?? payment.providerReference ?? `PAY-${payment.id.slice(0, 6).toUpperCase()}`,
      transferReference: payment.externalReference,
      paymentMethod: formatPaymentMethod(payment.method),
      status: payment.status,
      statusLabel: paymentLabels[payment.status],
      statusClassName: paymentTone[payment.status],
      submitted: payment.submittedAt ? formatInTimeZone(payment.submittedAt, timezone, "MMM d, h:mm a") : "Not submitted",
      duplicateReference: payment.duplicateReference
    };
  });

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Payment verification"
        description="Work from a compact queue first, then open each payment when proof review is needed."
      />
      <AdminNav current="payments" />

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardStat label="For Verification" value={String(submittedCount)} hint="Needs admin decision" />
        <DashboardStat label="Action Required" value={String(actionRequiredCount)} hint="Waiting on customer" />
        <DashboardStat label="Duplicate Flags" value={String(duplicateCount)} hint="Reference needs attention" />
      </div>

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Payment queue</h2>
          <p className="text-sm text-stone-400">{totalCount} records</p>
        </div>

        {totalCount === 0 ? (
          <p className="p-6 text-sm text-stone-400">No submitted payments are waiting for review.</p>
        ) : (
          <>
            <PaymentQueueTable rows={rows} />
            <PaymentQueuePagination page={page} pageSize={pageSize} totalCount={totalCount} />
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><h2 className="text-lg font-semibold text-white">Reschedule adjustment payments</h2><p className="mt-1 text-sm text-stone-400">Additional amounts submitted for replacement-slot verification.</p></div>
          <p className="text-sm text-stone-400">{rescheduleQueue.totalCount} records</p>
        </div>
        {rescheduleQueue.payments.length === 0 ? <p className="p-6 text-sm text-stone-400">No reschedule adjustment payments are waiting for review.</p> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-stone-950/60 text-xs uppercase tracking-[0.16em] text-stone-500"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Move</th><th className="px-5 py-3">Replacement schedule</th><th className="px-5 py-3">Additional amount</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Action</th></tr></thead>
                <tbody className="divide-y divide-white/10">{rescheduleQueue.payments.map((payment) => <tr key={payment.id} className="text-stone-300"><td className="px-5 py-4"><p className="font-medium text-white">{payment.bookingReschedule.booking.user.fullName}</p><p className="text-xs text-stone-500">{payment.bookingReschedule.booking.user.phone ?? payment.bookingReschedule.booking.user.email}</p></td><td className="px-5 py-4">{payment.bookingReschedule.originalFacility.name} → {payment.bookingReschedule.replacementFacility.name}</td><td className="px-5 py-4">{formatDateTimeRange(payment.bookingReschedule.replacementStartAtUtc, payment.bookingReschedule.replacementEndAtUtc, payment.bookingReschedule.replacementTimezone)}</td><td className="px-5 py-4 text-white">{formatCurrency(payment.amountMinor, "PHP")}</td><td className="px-5 py-4"><p>{payment.providerReference}</p><p className="text-xs text-stone-500">{payment.externalReference ?? "No transfer reference"}</p></td><td className="px-5 py-4"><Link className="text-amber-200 hover:underline" href={`/admin/reschedule-payments/${payment.id}`}>Review</Link></td></tr>)}</tbody>
              </table>
            </div>
            <AdminPagination basePath="/admin/payments" page={reschedulePage} pageSize={reschedulePageSize} totalCount={rescheduleQueue.totalCount} pageParam="reschedulePage" pageSizeParam="reschedulePageSize" />
          </>
        )}
      </section>
    </main>
  );
}
