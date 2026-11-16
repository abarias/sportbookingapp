"use client";

import type { PricingRule } from "@prisma/client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deletePricingRuleAction, savePricingRuleAction, togglePricingRuleAction, type PricingActionState } from "@/features/pricing/actions";

const initialState: PricingActionState = {};
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type EditableDayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY" | "SELECTED_DAYS";
const startTimeOptions = Array.from({ length: 24 }, (_, index) => index * 60);
const endTimeOptions = Array.from({ length: 24 }, (_, index) => (index + 1) * 60);

function timeLabel(minutes: number) {
  if (minutes === 1440) return "12:00 AM (midnight)";
  const hour = Math.floor(minutes / 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${suffix}`;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-stone-950 disabled:opacity-50" disabled={pending} type="submit">{pending ? "Saving..." : editing ? "Save rule" : "Add rule"}</button>;
}

function dateValue(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export function PricingRuleEditor({ facilityId, rule }: { facilityId: string; rule?: PricingRule | null }) {
  const [state, action] = useActionState(savePricingRuleAction, initialState);
  const [dayType, setDayType] = useState<EditableDayType>(rule?.dayType === "WEEKEND" || rule?.dayType === "HOLIDAY" || rule?.dayType === "SELECTED_DAYS" ? rule.dayType : "WEEKDAY");
  const showTimeRange = dayType !== "WEEKEND" && dayType !== "HOLIDAY";
  const showSelectedDays = dayType === "SELECTED_DAYS";
  const fieldClass = "h-11 w-full rounded-xl border border-white/10 bg-stone-900 px-3 text-sm text-white";

  return (
    <form action={action} className="space-y-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <input name="facilityId" type="hidden" value={facilityId} />
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-amber-300">{rule ? "Edit override" : "New override"}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Pricing schedule rule</h2>{rule ? <Link className="text-sm text-amber-200 underline-offset-4 hover:underline" href={`/admin/pricing?facilityId=${facilityId}`}>New override</Link> : null}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-stone-300">Admin label<input className={fieldClass} defaultValue={rule?.name ?? ""} maxLength={120} name="name" required /></label>
        <label className="text-sm text-stone-300">Customer rate label<input className={fieldClass} defaultValue={rule?.customerLabel ?? ""} maxLength={120} name="customerLabel" placeholder="Evening base rate" /></label>
        <label className="text-sm text-stone-300">Applicable days<select className={fieldClass} onChange={(event) => setDayType(event.target.value as EditableDayType)} value={dayType} name="dayType"><option value="WEEKDAY">Weekdays</option><option value="WEEKEND">Weekends</option><option value="HOLIDAY">Configured holidays</option><option value="SELECTED_DAYS">Selected days</option></select></label>
        <label className="text-sm text-stone-300">Base rate per hour (PHP)<input className={fieldClass} defaultValue={rule ? (rule.amountMinor / 100).toFixed(2) : ""} min="0.01" name="amount" required step="0.01" type="number" /></label>
        {showTimeRange ? <>
          <label className="text-sm text-stone-300">Start time<select className={fieldClass} defaultValue={rule?.startMinutes ?? 480} name="startTime" required>{startTimeOptions.map((minutes) => <option key={minutes} value={minutes}>{timeLabel(minutes)}</option>)}</select></label>
          <label className="text-sm text-stone-300">End time<select className={fieldClass} defaultValue={rule?.endMinutes ?? 1020} name="endTime" required>{endTimeOptions.map((minutes) => <option key={minutes} value={minutes}>{timeLabel(minutes)}</option>)}</select><span className="mt-1 block text-xs text-stone-500">Hourly boundaries only. Midnight is saved as the end of day.</span></label>
        </> : <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100 md:col-span-2">{dayType === "HOLIDAY" ? "Holiday pricing applies for all operating hours." : "Weekend pricing applies for all operating hours."}</p>}
        <label className="text-sm text-stone-300">Effective from<input className={fieldClass} defaultValue={dateValue(rule?.effectiveFrom)} name="effectiveFrom" type="date" /></label>
        <label className="text-sm text-stone-300">Effective until<input className={fieldClass} defaultValue={dateValue(rule?.effectiveUntil)} name="effectiveUntil" type="date" /></label>
        <label className="text-sm text-stone-300">Priority within this day type<input className={fieldClass} defaultValue={rule?.priority ?? 0} max="100" min="0" name="priority" required type="number" /></label>
        <label className="text-sm text-stone-300">Rate-card order<input className={fieldClass} defaultValue={rule?.displayOrder ?? 10} max="1000" min="0" name="displayOrder" required type="number" /></label>
      </div>
      {showSelectedDays ? <fieldset>
        <legend className="text-sm text-stone-300">Selected days (used only for Selected days)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((day, index) => <label key={day} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-stone-300"><input defaultChecked={rule?.daysOfWeek.includes(index)} name="daysOfWeek" type="checkbox" value={index} />{day}</label>)}
        </div>
      </fieldset> : null}
      <label className="flex items-center gap-3 text-sm text-stone-300"><input defaultChecked={rule?.isActive ?? true} name="isActive" type="checkbox" />Active rule</label>
      {state.error ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{state.error}</p> : null}
      {state.success ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{state.success}</p> : null}
      {state.fieldErrors ? <p className="text-sm text-rose-300">{Object.values(state.fieldErrors).filter(Boolean).join(" ")}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton editing={Boolean(rule)} />
        {rule ? <>
          <button className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white" formAction={togglePricingRuleAction} onClick={(event) => {
            if (!window.confirm(`${rule.isActive ? "Deactivate" : "Activate"} this pricing rule?`)) event.preventDefault();
          }} type="submit">{rule.isActive ? "Deactivate" : "Activate"}</button>
          <button className="rounded-full border border-rose-300/30 px-4 py-2.5 text-sm font-semibold text-rose-200" formAction={deletePricingRuleAction} onClick={(event) => {
            if (!window.confirm("Delete this pricing rule? This cannot be undone.")) event.preventDefault();
          }} type="submit">Delete rule</button>
        </> : null}
      </div>
    </form>
  );
}
