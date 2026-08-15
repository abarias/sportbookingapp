import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { DashboardStat } from "@/components/shared/dashboard-stat";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { getAdminReportsData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await requireAdminSession();
  const { bookings, facilities, reportStart } = await getAdminReportsData();

  const confirmedBookings = bookings.filter((booking) => booking.status === "CONFIRMED");
  const paidRevenueMinor = bookings
    .filter((booking) => booking.payment?.status === "PAID" || booking.payment?.status === "VERIFIED")
    .reduce((sum, booking) => sum + booking.amountMinor, 0);

  const bookingsByDay = new Map<string, number>();

  for (const booking of bookings) {
    const key = formatInTimeZone(booking.startAtUtc, booking.timezone, "yyyy-MM-dd");
    bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1);
  }

  const utilization = facilities.map((facility) => {
    const confirmed = confirmedBookings.filter((booking) => booking.facilityId === facility.id);
    const bookedMinutes = confirmed.reduce((sum, booking) => sum + (booking.slotCount * facility.slotIntervalMinutes), 0);
    const openMinutesPerWeek = facility.operatingHours.reduce((sum, hour) => {
      if (hour.isClosed) {
        return sum;
      }

      return sum + Math.max(hour.closesAtMinutes - hour.opensAtMinutes, 0);
    }, 0);
    const availableMinutesOver30Days = (openMinutesPerWeek / 7) * 30;
    const rate = availableMinutesOver30Days > 0 ? Math.round((bookedMinutes / availableMinutesOver30Days) * 100) : 0;

    return {
      facilityId: facility.id,
      name: facility.name,
      bookedMinutes,
      rate
    };
  });

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Reports"
        description="Review bookings by day, paid revenue, and facility utilization across the last 30 days."
      />
      <AdminNav current="reports" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStat label="Reporting Window" value="30 days" hint={`Since ${formatInTimeZone(reportStart, "Asia/Manila", "MMM d")}`} />
        <DashboardStat label="Bookings" value={String(bookings.length)} hint="All booking states" />
        <DashboardStat label="Confirmed" value={String(confirmedBookings.length)} hint="Reserved inventory" />
        <DashboardStat label="Paid Revenue" value={formatCurrency(paidRevenueMinor, "PHP")} hint="Verified and paid payments" />
      </div>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Bookings by day</h2>
          <div className="mt-4 space-y-3">
            {Array.from(bookingsByDay.entries())
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .slice(0, 14)
              .map(([date, count]) => (
                <div key={date} className="flex items-center justify-between rounded-2xl border border-white/10 bg-stone-950/40 px-4 py-3 text-sm text-stone-300">
                  <span>{date}</span>
                  <span className="text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Utilization by facility</h2>
          <div className="mt-4 space-y-3">
            {utilization.map((row) => (
              <div key={row.facilityId} className="rounded-2xl border border-white/10 bg-stone-950/40 px-4 py-3 text-sm text-stone-300">
                <div className="flex items-center justify-between">
                  <span className="text-white">{row.name}</span>
                  <span>{row.rate}%</span>
                </div>
                <p className="mt-1 text-stone-400">{Math.round(row.bookedMinutes / 60)} booked hours over 30 days</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
