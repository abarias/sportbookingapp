import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { HolidayEditor } from "@/components/admin/holiday-editor";
import { SectionHeading } from "@/components/shared/section-heading";
import { toggleHolidayAction } from "@/features/pricing/actions";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHolidaysPage({ searchParams }: { searchParams: Promise<{ holidayId?: string }> }) {
  await requireAdminSession();
  const params = await searchParams;
  const [facilities, holidays] = await Promise.all([
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.holiday.findMany({ orderBy: [{ date: "asc" }, { name: "asc" }], include: { facility: { select: { name: true } } } })
  ]);
  const selectedHoliday = holidays.find((holiday) => holiday.id === params.holidayId) ?? null;

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin" title="Holiday calendar" description="Manage global and facility-specific holidays used by the pricing engine." />
      <AdminNav current="holidays" />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{selectedHoliday ? "Edit holiday" : "Add holiday"}</h2>
          <p className="mt-1 text-sm text-stone-400">Global holidays apply to every facility. Use a facility-specific holiday only when its schedule differs.</p>
        </div>
        <HolidayEditor facilities={facilities} holiday={selectedHoliday} />
        {selectedHoliday ? <Link className="inline-flex text-sm text-amber-200 underline-offset-4 hover:underline" href="/admin/holidays">Add another holiday</Link> : null}
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold text-white">Configured holidays</h2><p className="mt-1 text-sm text-stone-400">Inactive holidays remain in the calendar for audit history but do not affect pricing.</p></div>
        {holidays.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-stone-400">No holidays configured.</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {holidays.map((holiday) => (
            <article key={holiday.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-medium text-white">{holiday.name}</p><span className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-wide ${holiday.isActive ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-stone-400"}`}>{holiday.isActive ? "Active" : "Inactive"}</span></div>
              <p className="mt-2 text-sm text-stone-400">{holiday.date.toISOString().slice(0, 10)} · {holiday.facility?.name ?? "All facilities"}</p>
              <div className="mt-4 flex gap-3"><Link className="text-sm text-amber-200 underline-offset-4 hover:underline" href={`/admin/holidays?holidayId=${holiday.id}`}>Edit</Link><form action={toggleHolidayAction}><input name="holidayId" type="hidden" value={holiday.id} /><button className="text-sm text-amber-200 underline-offset-4 hover:underline" type="submit">{holiday.isActive ? "Deactivate" : "Activate"}</button></form></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
