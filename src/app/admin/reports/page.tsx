import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { DashboardStat } from "@/components/shared/dashboard-stat";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { getAdminReportsData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await requirePermission("reports.view");
  const { bookings, facilities, additionalPayments, reschedules, reportStart } = await getAdminReportsData();

  const confirmedBookings = bookings.filter((booking) => booking.status === "CONFIRMED");
  const paidRevenueMinor = bookings
    .filter((booking) => booking.payment?.status === "PAID" || booking.payment?.status === "VERIFIED")
    .reduce((sum, booking) => sum + (booking.payment?.amountMinor ?? 0), 0);
  const additionalRevenueMinor = additionalPayments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const unresolvedAdjustments = reschedules.filter((item) => item.adjustmentStatus === "UNRESOLVED");
  const waivedAmountMinor = reschedules.reduce((sum, item) => sum + item.waivedAmountMinor, 0);

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
        <DashboardStat label="Paid Base Revenue" value={formatCurrency(paidRevenueMinor + additionalRevenueMinor, "PHP")} hint={`${formatCurrency(additionalRevenueMinor, "PHP")} from verified reschedule adjustments`} />
      </div>
      <div className="grid gap-4 md:grid-cols-3"><DashboardStat label="Reschedules" value={String(reschedules.length)} hint="Created in reporting window" /><DashboardStat label="Unresolved adjustments" value={String(unresolvedAdjustments.length)} hint="Manual refund or credit decision needed" /><DashboardStat label="Waived adjustments" value={formatCurrency(waivedAmountMinor, "PHP")} hint="Not counted as revenue" /></div>
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
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"><h2 className="text-lg font-semibold text-white">Recent reschedules</h2><div className="mt-4 space-y-3">{reschedules.slice(0, 20).map((item) => <div key={item.id} className="grid gap-2 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300 md:grid-cols-2 xl:grid-cols-4"><p><span className="text-stone-500">Move:</span> {item.originalFacility.name} → {item.replacementFacility.name}<span className="mt-1 block text-xs text-stone-500">{formatInTimeZone(item.originalStartAtUtc, item.originalTimezone, "MMM d, yyyy h:mm a")} → {formatInTimeZone(item.replacementStartAtUtc, item.replacementTimezone, "MMM d, yyyy h:mm a")}</span></p><p><span className="text-stone-500">Status:</span> {item.status.replaceAll("_", " ")}<span className="mt-1 block text-xs text-stone-500">Adjustment: {item.adjustmentStatus.replaceAll("_", " ")}</span></p><p><span className="text-stone-500">Price:</span> {formatCurrency(item.originalAmountMinor, "PHP")} → {formatCurrency(item.replacementAmountMinor, "PHP")}<span className="mt-1 block text-xs text-stone-500">Additional verified payments are counted separately; waivers are excluded.</span></p><p><span className="text-stone-500">Admin:</span> {item.initiatedBy.fullName}<span className="mt-1 block text-xs text-stone-500">Created {formatInTimeZone(item.createdAt, "Asia/Manila", "MMM d, yyyy h:mm a")}</span></p></div>)}{reschedules.length === 0 ? <p className="text-sm text-stone-400">No reschedules in this reporting window.</p> : null}</div></section>
    </main>
  );
}
