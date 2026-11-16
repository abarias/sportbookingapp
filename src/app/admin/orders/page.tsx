import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getAdminBookingOrdersData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; search?: string }> }) {
  const authorization = await requirePermission("bookings.view");
  const params = await searchParams;
  const page = positiveInteger(params.page, 1);
  const pageSize = [10, 25, 50].includes(positiveInteger(params.pageSize, 10)) ? positiveInteger(params.pageSize, 10) : 10;
  const data = await getAdminBookingOrdersData({ page, pageSize, search: params.search, includeFullCustomer: authorization.permissions.has("customers.view_full") });
  const totalPages = Math.max(1, Math.ceil(data.totalCount / pageSize));
  if (page > totalPages) redirect(`/admin/orders?page=${totalPages}&pageSize=${pageSize}`);

  return <main className="space-y-8 pb-16">
    <SectionHeading eyebrow="Admin" title="Booking orders" description="Search consolidated checkouts and open their individual facility bookings." />
    <AdminNav current="orders" />
    <form className="flex flex-col gap-3 sm:flex-row" action="/admin/orders"><label className="sr-only" htmlFor="order-search">Search orders</label><input id="order-search" name="search" defaultValue={params.search} placeholder="Order, booking, facility, or customer" className="min-h-12 flex-1 rounded-xl border border-white/10 bg-stone-950/60 px-4 text-white" /><button className="min-h-12 rounded-xl bg-amber-400 px-5 font-medium text-stone-950">Search</button></form>
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
      {data.orders.length === 0 ? <p className="p-6 text-sm text-stone-400">No booking orders match this search.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-stone-950/60 text-xs uppercase tracking-[0.14em] text-stone-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Bookings</th><th className="px-5 py-3">VAT-exclusive amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Checkout</th></tr></thead><tbody className="divide-y divide-white/10">{data.orders.map((order) => <tr key={order.id} className="text-stone-300"><td className="px-5 py-4"><Link className="font-medium text-amber-200 hover:underline" href={order.payment ? `/admin/payments/${order.payment.id}` : `/admin/orders`}>{order.reference}</Link></td><td className="px-5 py-4"><p className="text-white">{order.user.fullName}</p>{order.customerContact ? <p className="text-xs text-stone-500">{order.customerContact}</p> : null}</td><td className="px-5 py-4"><p>{order.bookings.length} booking{order.bookings.length === 1 ? "" : "s"}</p><p className="max-w-sm truncate text-xs text-stone-500">{order.bookings.map((booking) => booking.facility.name).join(", ")}</p></td><td className="px-5 py-4 text-white">{formatCurrency(order.baseAmountMinor, "PHP")}</td><td className="px-5 py-4">{order.status.replaceAll("_", " ")}</td><td className="px-5 py-4">{formatInTimeZone(order.checkoutAt, "Asia/Manila", "MMM d, yyyy h:mm a")}</td></tr>)}</tbody></table></div>}
      <AdminPagination basePath="/admin/orders" page={page} pageSize={pageSize} totalCount={data.totalCount} />
    </section>
  </main>;
}
