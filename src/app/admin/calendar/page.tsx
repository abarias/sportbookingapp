import Link from "next/link";

import { AdminDayDetail, AdminCalendarGrid } from "@/components/admin/admin-calendar-view";
import { AdminNav } from "@/components/admin/admin-nav";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatDateLabel } from "@/lib/time/slots";
import { getAdminCalendarData } from "@/server/admin/calendar";

export const dynamic = "force-dynamic";

type AdminCalendarPageProps = {
  searchParams: Promise<{
    month?: string;
    date?: string;
    view?: string;
    facilityId?: string;
  }>;
};

export default async function AdminCalendarPage({ searchParams }: AdminCalendarPageProps) {
  await requireAdminSession();
  const params = await searchParams;
  const view = params.view === "facility" ? "facility" : "schedule";
  const data = await getAdminCalendarData({
    month: params.month,
    date: params.date
  });

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Booking calendar"
        description="Monthly booking visibility with daily drill-down into schedules, facility activity, and slot-level availability."
      />
      <AdminNav current="calendar" />

      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{data.monthLabel}</h2>
          <p className="mt-1 text-sm text-stone-400">
            Selected date: {formatDateLabel(data.selectedDateKey, data.timezone)} in {data.timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/calendar?month=${data.previousMonthKey}&date=${data.previousMonthKey}-01&view=${view}`}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Previous month
          </Link>
          <Link
            href={`/admin/calendar?month=${data.nextMonthKey}&date=${data.nextMonthKey}-01&view=${view}`}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Next month
          </Link>
        </div>
      </section>

      <AdminCalendarGrid
        days={data.days}
        monthKey={data.monthKey}
        selectedDateKey={data.selectedDateKey}
        selectedView={view}
      />

      <AdminDayDetail
        dateKey={data.selectedDateKey}
        daySchedules={data.daySchedules}
        facilityId={params.facilityId}
        monthKey={data.monthKey}
        view={view}
      />
    </main>
  );
}
