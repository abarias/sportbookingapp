import { AdminNav } from "@/components/admin/admin-nav";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { DashboardStat } from "@/components/shared/dashboard-stat";
import { SectionHeading } from "@/components/shared/section-heading";
import { updateCancellationSettingAction } from "@/features/admin/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getAdminOverviewData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authorization = await requirePermission("bookings.view");
  const { session } = authorization;
  const canViewFinancials = authorization.permissions.has("reports.view");
  const canManageFacilities = authorization.permissions.has("facilities.manage");
  const { stats: overviewStats, recentBookings, cancellationEnabled, cancellationWindowHours } = await getAdminOverviewData({
    fullCustomerAccess: authorization.permissions.has("customers.view_full"),
    includeFinancials: canViewFinancials,
    includePaymentDetails: authorization.permissions.has("payments.view")
  });

  const stats = [
    { label: "Confirmed Bookings", value: String(overviewStats.confirmedCount), hint: "Recent confirmed records" },
    { label: "Pending Payment", value: String(overviewStats.pendingCount), hint: "Reservations still awaiting completion" },
    ...(canViewFinancials ? [{ label: "Paid Revenue", value: formatCurrency(overviewStats.paidRevenueMinor, "PHP"), hint: "From paid payment records" }] : []),
    { label: "Enabled Facilities", value: String(overviewStats.enabledFacilities), hint: "Currently bookable inventory" }
  ];

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Operational overview"
        description="Monitor booking activity, payment status, and facility operations from one admin workspace."
      />
      <AdminNav current="overview" />
      <section className="rounded-[1.75rem] border border-amber-400/15 bg-amber-400/10 p-4 text-sm text-amber-100">
        Signed in as {session.user.name} ({session.user.email})
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardStat key={stat.label} {...stat} />
        ))}
      </div>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Recent bookings</h2>
          <div className="mt-4 space-y-4">
            {recentBookings.map((booking) => (
              <article key={booking.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-white">{booking.facility.name}</p>
                    <p>{booking.customerName}{booking.customerContact ? ` • ${booking.customerContact}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <BookingStatusBadge bookingStatus={booking.status} paymentStatus={booking.payment?.status ?? null} />
                    {booking.payment?.provider ? <p className="mt-2 text-stone-400">{booking.payment.provider} provider</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        {canManageFacilities ? <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Global policy</h2>
          <form action={updateCancellationSettingAction} className="mt-4 space-y-4">
            <label className="flex items-center gap-3 text-sm text-stone-300">
              <input defaultChecked={cancellationEnabled} name="enabled" type="checkbox" />
              Customer cancellation enabled globally
            </label>
            <label className="space-y-2 text-sm text-stone-300">
              <span className="block">Cancellation window after booking</span>
              <input
                className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white"
                defaultValue={cancellationWindowHours}
                min={1}
                name="cancellationWindowHours"
                type="number"
              />
            </label>
            <button className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15" type="submit">
              Save policy
            </button>
          </form>
          <div className="mt-6 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300">
            Use the calendar, facilities, customer, and reporting sections to manage daily operations.
          </div>
        </div> : null}
      </section>
    </main>
  );
}
