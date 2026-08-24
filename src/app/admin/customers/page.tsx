import { AdminNav } from "@/components/admin/admin-nav";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminCustomersData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requirePermission("customers.view_full");
  const customers = await getAdminCustomersData();

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Customers"
        description="View customer accounts, booking counts, and recent booking history with booking and payment status visibility."
      />
      <AdminNav current="customers" />
      <div className="grid gap-6">
        {customers.map((customer) => (
          <section key={customer.id} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{customer.fullName}</h2>
                <p className="text-sm text-stone-400">{customer.email}</p>
                {customer.phone ? <p className="text-sm text-stone-400">{customer.phone}</p> : null}
              </div>
              <div className="text-sm text-stone-300">{customer.bookings.length} total bookings</div>
            </div>
            <div className="mt-4 space-y-4">
              {customer.bookings.length === 0 ? <p className="text-sm text-stone-400">No bookings yet.</p> : null}
              {customer.bookings.slice(0, 8).map((booking) => (
                <article key={booking.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium text-white">{booking.facility.name}</p>
                      <p className="mt-1">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
                      <p className="mt-1 text-stone-400">{booking.payment?.provider ?? "No payment"} provider</p>
                    </div>
                    <BookingStatusBadge bookingStatus={booking.status} paymentStatus={booking.payment?.status ?? null} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
