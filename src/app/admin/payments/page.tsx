import { PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { PaymentQueuePagination } from "@/components/admin/payment-queue-pagination";
import { PaymentQueueTable, type PaymentQueueRow } from "@/components/admin/payment-queue-table";
import { DashboardStat } from "@/components/shared/dashboard-stat";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminPaymentQueueData } from "@/server/admin/queries";

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
  await requireAdminSession();
  const params = await searchParams;
  const page = parsePositiveInteger(params.page, 1);
  const pageSize = parsePageSize(params.pageSize);
  const { payments, totalCount, submittedCount, actionRequiredCount, duplicateCount } = await getAdminPaymentQueueData({ page, pageSize });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (page > totalPages) {
    redirect(`/admin/payments?page=${totalPages}&pageSize=${pageSize}`);
  }

  const rows: PaymentQueueRow[] = payments.map((payment) => ({
    id: payment.id,
    customerName: payment.booking.user.fullName,
    customerContact: payment.booking.user.phone ?? payment.booking.user.email,
    schedule: formatDateTimeRange(payment.booking.startAtUtc, payment.booking.endAtUtc, payment.booking.timezone),
    facilityName: payment.booking.facility.name,
    amountDue: formatCurrency(payment.amountMinor, "PHP"),
    amountClaimed: payment.amountPaidMinor ? formatCurrency(payment.amountPaidMinor, "PHP") : null,
    bookingReference: payment.providerReference ?? `PAY-${payment.id.slice(0, 6).toUpperCase()}`,
    transferReference: payment.externalReference,
    paymentMethod: formatPaymentMethod(payment.method),
    status: payment.status,
    statusLabel: paymentLabels[payment.status],
    statusClassName: paymentTone[payment.status],
    submitted: payment.submittedAt ? formatInTimeZone(payment.submittedAt, payment.booking.timezone, "MMM d, h:mm a") : "Not submitted",
    duplicateReference: payment.duplicateReference
  }));

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
    </main>
  );
}
