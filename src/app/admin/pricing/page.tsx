import Link from "next/link";
import { PricingDayType } from "@prisma/client";

import { AdminNav } from "@/components/admin/admin-nav";
import { CopyPricingScheduleForm } from "@/components/admin/copy-pricing-schedule-form";
import { PricingFacilityList } from "@/components/admin/pricing-facility-list";
import { PricingRuleEditor } from "@/components/admin/pricing-rule-editor";
import { RateCard } from "@/components/pricing/rate-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { formatCurrency } from "@/lib/formatting/currency";
import { requireAdminSession } from "@/lib/auth/session";
import { getTodayDateKey, minutesToTimeInputValue, minutesToTimeLabel } from "@/lib/time/slots";
import { analyzePricingRules, deriveRateCard } from "@/server/pricing/engine";
import { getPricingAdminData } from "@/server/pricing/queries";

export const dynamic = "force-dynamic";

function parseTime(value: string | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return 480;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default async function AdminPricingPage({ searchParams }: { searchParams: Promise<{ facilityId?: string; date?: string; start?: string; duration?: string; ruleId?: string }> }) {
  await requireAdminSession();
  const params = await searchParams;
  const dateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : getTodayDateKey("Asia/Manila");
  const startMinutes = parseTime(params.start);
  const durationMinutes = Math.max(30, Math.min(240, Number.parseInt(params.duration ?? "60", 10) || 60));
  const { facilities, selectedFacility, preview, futureBookingCount } = await getPricingAdminData(params.facilityId, dateKey, startMinutes, durationMinutes);

  if (!selectedFacility) {
    return <main className="space-y-8 pb-16"><SectionHeading eyebrow="Admin" title="Dynamic pricing" description="Create a facility before configuring pricing." /><AdminNav current="pricing" /></main>;
  }

  const editableRules = selectedFacility.pricingRules.filter((rule) => rule.dayType !== PricingDayType.DEFAULT);
  const selectedRule = editableRules.find((rule) => rule.id === params.ruleId) ?? null;
  const diagnostics = analyzePricingRules(selectedFacility.pricingRules);
  const rateCard = deriveRateCard(selectedFacility.pricingRules);
  const defaultRule = selectedFacility.pricingRules.find((rule) => rule.dayType === PricingDayType.DEFAULT && rule.isActive);

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin" title="Dynamic pricing" description="Manage VAT-exclusive base rates and schedule overrides from one facility workspace." />
      <AdminNav current="pricing" />

      {futureBookingCount > 0 ? <p className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">This facility has {futureBookingCount} active future booking{futureBookingCount === 1 ? "" : "s"}. Pricing changes apply only to new bookings; recorded booking amounts and snapshots will not change.</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <PricingFacilityList
          dateKey={dateKey}
          facilities={facilities.map((facility) => ({
            id: facility.id,
            name: facility.name,
            type: facility.type,
            isEnabled: facility.isEnabled,
            images: facility.images,
            pricingRules: facility.pricingRules.filter((rule) => rule.dayType === PricingDayType.DEFAULT)
          }))}
          selectedFacilityId={selectedFacility.id}
        />

        <div className="space-y-6">
          <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">{selectedFacility.name}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Schedule overrides</h2>
              <p className="mt-1 text-sm text-stone-400">Select a rule to edit its rate and schedule.</p>
            </div>
            <Link className="shrink-0 rounded-full bg-amber-300 px-3 py-2 text-xs font-semibold text-stone-950" href={`/admin/pricing?facilityId=${selectedFacility.id}&date=${dateKey}`}>New rule</Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Fallback rate</p>
            <p className="mt-1 text-lg font-semibold text-white">{defaultRule ? formatCurrency(defaultRule.amountMinor, "PHP") : "Missing"}</p>
            <p className="mt-1 text-xs text-stone-400">Per hour, VAT exclusive</p>
          </div>

          <div className="space-y-2">
            {editableRules.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-stone-400">No schedule overrides yet.</p> : null}
            {editableRules.map((rule) => {
              const isSelected = selectedRule?.id === rule.id;
              return (
                <Link
                  key={rule.id}
                  href={`/admin/pricing?facilityId=${selectedFacility.id}&date=${dateKey}&ruleId=${rule.id}`}
                  className={`block rounded-2xl border p-4 transition ${isSelected ? "border-amber-300/70 bg-amber-300/10 shadow-[0_0_0_1px_rgba(252,211,77,0.2)]" : "border-white/10 bg-stone-950/40 hover:border-white/25"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-medium text-white">{rule.name}</p><p className="mt-1 text-sm text-stone-400">{rule.dayType.replace("_", " ")}</p></div>
                    {isSelected ? <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-950">Editing</span> : null}
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{rule.dayType === PricingDayType.WEEKEND || rule.dayType === PricingDayType.HOLIDAY ? "All operating hours" : `${minutesToTimeLabel(rule.startMinutes)} - ${minutesToTimeLabel(rule.endMinutes)}`} · {formatCurrency(rule.amountMinor, "PHP")}/hour</p>
                  <p className="mt-1 text-xs text-stone-500">{rule.isActive ? "Active" : "Inactive"} · priority {rule.priority}</p>
                </Link>
              );
            })}
          </div>

          </section>

          <PricingRuleEditor key={`${selectedFacility.id}-${selectedRule?.id ?? "new"}`} facilityId={selectedFacility.id} rule={selectedRule} />
          <CopyPricingScheduleForm sourceFacilityId={selectedFacility.id} facilities={facilities.map(({ id, name }) => ({ id, name }))} />

          <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Configuration checks</h2>
            {diagnostics.length === 0 ? <p className="mt-3 text-sm text-emerald-200">No missing default, duplicate, or ambiguous rules detected.</p> : <div className="mt-3 space-y-2">{diagnostics.map((item, index) => <p key={`${item.code}-${index}`} className={`rounded-xl p-3 text-sm ${item.severity === "error" ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-100"}`}>{item.message}</p>)}</div>}
          </section>

          <form className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5" method="get">
            <input name="facilityId" type="hidden" value={selectedFacility.id} />
            <h2 className="text-lg font-semibold text-white">Price preview</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-stone-300">Date<input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-stone-900 px-3 text-white" defaultValue={dateKey} name="date" type="date" /></label>
              <label className="text-sm text-stone-300">Start<input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-stone-900 px-3 text-white" defaultValue={minutesToTimeInputValue(startMinutes)} name="start" step="1800" type="time" /></label>
              <label className="text-sm text-stone-300">Minutes<select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-stone-900 px-3 text-white" defaultValue={durationMinutes} name="duration"><option value="60">60</option><option value="120">120</option><option value="180">180</option><option value="240">240</option></select></label>
            </div>
            <button className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-950" type="submit">Preview price</button>
            {preview ? <div className="mt-4 rounded-2xl bg-stone-950/60 p-4"><p className="text-sm text-stone-400">VAT-exclusive base amount</p><p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(preview.amountMinor, "PHP")}</p>{preview.holidayName ? <p className="mt-1 text-sm text-amber-200">Holiday: {preview.holidayName}</p> : null}<div className="mt-3 space-y-2">{preview.segments.map((segment) => <p key={`${segment.startMinutes}-${segment.ruleId}`} className="text-sm text-stone-300">{minutesToTimeLabel(segment.startMinutes)}-{minutesToTimeLabel(segment.endMinutes)} · {segment.rateLabel} · {formatCurrency(segment.amountMinor, "PHP")}</p>)}</div></div> : <p className="mt-4 text-sm text-rose-200">The selected range is closed, outside operating hours, or not covered by a valid rule.</p>}
          </form>

          <RateCard rows={rateCard} compact />
        </div>
      </div>

      <p className="text-sm text-stone-400">Manage global and facility-specific holidays from the <Link className="text-amber-200 underline-offset-4 hover:underline" href="/admin/holidays">Holiday calendar</Link>.</p>
    </main>
  );
}
