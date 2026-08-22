"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Holiday } from "@prisma/client";

import { saveHolidayAction, type PricingActionState } from "@/features/pricing/actions";

const initialState: PricingActionState = {};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50" disabled={pending} type="submit">{pending ? "Saving..." : editing ? "Save holiday" : "Add holiday"}</button>;
}

export function HolidayEditor({ facilities, holiday }: { facilities: Array<{ id: string; name: string }>; holiday?: Holiday | null }) {
  const [state, action] = useActionState(saveHolidayAction, initialState);
  const inputClass = "h-11 rounded-xl border border-white/10 bg-stone-900 px-3 text-sm text-white";
  return (
    <form action={action} className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
      {holiday ? <input name="holidayId" type="hidden" value={holiday.id} /> : null}
      <label className="grid gap-1 text-sm text-stone-300">Holiday name<input className={inputClass} defaultValue={holiday?.name ?? ""} name="name" required /></label>
      <label className="grid gap-1 text-sm text-stone-300">Date<input className={inputClass} defaultValue={holiday?.date.toISOString().slice(0, 10) ?? ""} name="date" required type="date" /></label>
      <label className="grid gap-1 text-sm text-stone-300">Applies to<select className={inputClass} defaultValue={holiday?.facilityId ?? ""} name="facilityId"><option value="">All facilities</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
      <input name="isActive" type="hidden" value={holiday?.isActive === false ? "" : "on"} />
      <SubmitButton editing={Boolean(holiday)} />
      {state.error || state.success ? <p className={`text-sm md:col-span-4 ${state.error ? "text-rose-300" : "text-emerald-300"}`}>{state.error ?? state.success}</p> : null}
    </form>
  );
}
