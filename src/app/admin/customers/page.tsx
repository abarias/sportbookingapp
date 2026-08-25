import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getPaymentProofUrl } from "@/lib/storage/payment-proofs";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminCustomersData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value, PAGE_SIZE_OPTIONS[0]);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : PAGE_SIZE_OPTIONS[0];
}

function formatPaymentMethod(method: string | null) {
  return method ? method.replaceAll("_", " ") : "Not set";
}

type AdminCustomersPageProps = {
  searchParams: Promise<{
    customerId?: string;
    search?: string;
    page?: string;
    pageSize?: string;
    bookingPage?: string;
    bookingPageSize?: string;
  }>;
};

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  const authorization = await requirePermission("customers.view_full");
  const params = await searchParams;
  const page = parsePositiveInteger(params.page, 1);
  const pageSize = parsePageSize(params.pageSize);
  const bookingPage = parsePositiveInteger(params.bookingPage, 1);
  const bookingPageSize = parsePageSize(params.bookingPageSize);
  const search = params.search?.trim() ?? "";
  const { customers, totalCount, selectedCustomer, selectedBookingCount } = await getAdminCustomersData({
    page,
    pageSize,
    search,
    selectedCustomerId: params.customerId,
    bookingPage,
    bookingPageSize
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const bookingTotalPages = Math.max(1, Math.ceil(selectedBookingCount / bookingPageSize));

  if (page > totalPages) {
    redirect(`/admin/customers?page=${totalPages}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  }
  if (selectedCustomer && bookingPage > bookingTotalPages) {
    redirect(`/admin/customers?customerId=${selectedCustomer.id}&bookingPage=${bookingTotalPages}&bookingPageSize=${bookingPageSize}&page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  }

  const bookings = selectedCustomer ? await Promise.all(selectedCustomer.bookings.map(async (booking) => ({
    ...booking,
    proofUrl: booking.payment ? await getPaymentProofUrl(booking.payment.proofImageUrl) : null
  }))) : [];

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Customers"
        description="Search customer accounts, then review their booking history and payment records without leaving the customer workspace."
      />
      <AdminNav current="customers" />

      <form className="flex flex-col gap-3 sm:flex-row" method="get">
        <input className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white" defaultValue={search} name="search" placeholder="Search name, email, or mobile number" />
        <button className="h-11 rounded-full bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/15" type="submit">Search customers</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="self-start overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 xl:sticky xl:top-24">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-white">Customer accounts</h2>
              <span className="text-sm text-stone-500">{totalCount}</span>
            </div>
          </div>
          <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/customers?customerId=${customer.id}&page=${page}&pageSize=${pageSize}&bookingPage=1&bookingPageSize=${bookingPageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className={`block rounded-2xl border p-4 text-sm transition ${selectedCustomer?.id === customer.id ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-stone-950/40 hover:bg-white/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-white">{customer.fullName}</span>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs text-stone-300">{customer._count.bookings} bookings</span>
                </div>
                <p className="mt-2 truncate text-stone-400">{customer.email}</p>
                <p className="mt-1 text-xs text-stone-500">{customer.phone ?? "No mobile number"}</p>
              </Link>
            ))}
            {customers.length === 0 ? <p className="p-3 text-sm text-stone-400">No customer accounts match this search.</p> : null}
          </div>
          <AdminPagination basePath="/admin/customers" page={page} pageSize={pageSize} totalCount={totalCount} compact />
        </aside>

        {selectedCustomer ? (
          <section className="min-w-0 space-y-6">
            <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Customer profile</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCustomer.fullName}</h2>
                  <div className="mt-3 space-y-1 text-sm text-stone-400">
                    <p>{selectedCustomer.email}</p>
                    <p>{selectedCustomer.phone ?? "No mobile number"}</p>
                    <p>Customer since {formatInTimeZone(selectedCustomer.createdAt, "Asia/Manila", "MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-stone-950/40 px-4 py-3 text-sm text-stone-300">
                  <span className="text-2xl font-semibold text-white">{selectedBookingCount}</span>
                  <span className="ml-2">total bookings</span>
                </div>
              </div>
            </article>

            <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Customer activity</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">Booking transactions</h2>
                  </div>
                  <p className="text-sm text-stone-400">Payment details and proof history</p>
                </div>
              </div>
              {bookings.length === 0 ? (
                <p className="p-6 text-sm text-stone-400">This customer has no booking transactions yet.</p>
              ) : (
                <div className="divide-y divide-white/10">
                  {bookings.map((booking) => (
                    <article key={booking.id} className="p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-semibold text-white">{booking.facility.name}</h3>
                            <BookingStatusBadge bookingStatus={booking.status} paymentStatus={booking.payment?.status ?? null} />
                          </div>
                          <p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
                          <p className="mt-1 text-xs text-stone-500">Booking reference: {booking.payment?.providerReference ?? `BOOK-${booking.id.slice(0, 8).toUpperCase()}`}</p>
                          {authorization.permissions.has("bookings.reschedule") ? <Link className="mt-2 inline-flex text-sm text-amber-200 hover:underline" href={`/admin/bookings/${booking.id}`}>View booking details</Link> : null}
                        </div>
                        <div className="text-left lg:text-right">
                          <p className="text-lg font-semibold text-white">{formatCurrency(booking.amountMinor, booking.currency as "PHP")}</p>
                          <p className="text-xs text-stone-500">VAT-exclusive base amount</p>
                        </div>
                      </div>

                      {booking.payment ? (
                        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300 sm:grid-cols-2 lg:grid-cols-3">
                          <p><span className="text-stone-500">Payment method:</span> {formatPaymentMethod(booking.payment.method)}</p>
                          <p><span className="text-stone-500">Provider:</span> {booking.payment.provider}</p>
                          <p><span className="text-stone-500">Payment status:</span> {booking.payment.status.replaceAll("_", " ")}</p>
                          <p><span className="text-stone-500">Transfer reference:</span> {booking.payment.externalReference ?? "Not provided"}</p>
                          <p><span className="text-stone-500">Amount paid:</span> {booking.payment.amountPaidMinor === null ? "Not recorded" : formatCurrency(booking.payment.amountPaidMinor, booking.payment.currency as "PHP")}</p>
                          <p><span className="text-stone-500">Submitted:</span> {booking.payment.submittedAt ? formatInTimeZone(booking.payment.submittedAt, booking.timezone, "MMM d, yyyy h:mm a") : "Not submitted"}</p>
                          {booking.payment.reviewNote ? <p className="sm:col-span-2 lg:col-span-3"><span className="text-stone-500">Staff note:</span> {booking.payment.reviewNote}</p> : null}
                        </div>
                      ) : <p className="mt-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-400">No payment record is attached to this booking.</p>}

                      {booking.proofUrl ? (
                        <Link href={booking.proofUrl} target="_blank" className="mt-4 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-amber-200 transition hover:bg-white/10">
                          <Image src={booking.proofUrl} alt="Payment proof thumbnail" width={64} height={48} className="h-12 w-16 rounded-lg object-cover" />
                          View uploaded payment proof
                        </Link>
                      ) : booking.payment?.proofImageUrl ? <p className="mt-4 text-sm text-stone-500">Payment proof is recorded but is currently unavailable.</p> : null}
                    </article>
                  ))}
                </div>
              )}
              {selectedBookingCount > 0 ? <AdminPagination basePath="/admin/customers" page={bookingPage} pageSize={bookingPageSize} totalCount={selectedBookingCount} pageParam="bookingPage" pageSizeParam="bookingPageSize" /> : null}
            </section>
          </section>
        ) : (
          <section className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-8 text-stone-400">
            Select a customer to review their booking transactions and payment details.
          </section>
        )}
      </div>
    </main>
  );
}
