"use client";

import { useActionState } from "react";

import { copyPricingScheduleAction, type PricingActionState } from "@/features/pricing/actions";

const initialState: PricingActionState = {};

export function CopyPricingScheduleForm({ sourceFacilityId, facilities }: { sourceFacilityId: string; facilities: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(copyPricingScheduleAction, initialState);
  return (
    <form action={action} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5" onSubmit={(event) => {
      if (!window.confirm("Replace the target facility's schedule overrides? Its default rate and historical bookings will be preserved.")) event.preventDefault();
    }}>
      <input name="sourceFacilityId" type="hidden" value={sourceFacilityId} />
      <h2 className="text-lg font-semibold text-white">Copy pricing schedule</h2>
      <p className="mt-1 text-sm text-stone-400">Copies all overrides to another facility while preserving its fallback rate.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select className="h-11 flex-1 rounded-xl border border-white/10 bg-stone-900 px-3 text-sm text-white" defaultValue="" name="targetFacilityId" required>
          <option disabled value="">Choose target facility</option>
          {facilities.filter((facility) => facility.id !== sourceFacilityId).map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
        </select>
        <button className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white" type="submit">Copy overrides</button>
      </div>
      {state.error || state.success ? <p className={`mt-3 text-sm ${state.error ? "text-rose-300" : "text-emerald-300"}`}>{state.error ?? state.success}</p> : null}
    </form>
  );
}
