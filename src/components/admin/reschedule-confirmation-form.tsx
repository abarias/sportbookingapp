"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { initiateRescheduleAction, type RescheduleActionState } from "@/features/rescheduling/actions";
import { formatCurrency } from "@/lib/formatting/currency";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 disabled:opacity-50" disabled={pending} type="submit">{pending ? "Confirming..." : "Confirm reschedule"}</button>;
}

export function RescheduleConfirmationForm(props: {
  bookingId: string;
  replacementFacilityId: string;
  dateKey: string;
  startMinutes: number;
  differenceMinor: number;
  canOverrideAdjustment: boolean;
}) {
  const [state, action] = useActionState(initiateRescheduleAction, {} as RescheduleActionState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      action={action}
      className="space-y-5 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/5 p-6"
      onSubmit={(event) => {
        if (!window.confirm("Confirm this reschedule? The server will recheck availability and pricing before making any changes.")) event.preventDefault();
      }}
    >
      <input name="bookingId" type="hidden" value={props.bookingId} />
      <input name="replacementFacilityId" type="hidden" value={props.replacementFacilityId} />
      <input name="dateKey" type="hidden" value={props.dateKey} />
      <input name="startMinutes" type="hidden" value={props.startMinutes} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Final confirmation</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Document why this booking is moving</h2>
      </div>
      <label className="block space-y-2 text-sm text-stone-200">
        <span>Rescheduling reason</span>
        <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-white" maxLength={500} name="reason" required />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 text-sm text-stone-200">
          <span>Customer-facing note (optional)</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-white" maxLength={1000} name="customerNote" />
        </label>
        <label className="block space-y-2 text-sm text-stone-200">
          <span>Internal note (optional)</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-white" maxLength={1000} name="internalNote" />
        </label>
      </div>
      {props.differenceMinor > 0 && props.canOverrideAdjustment ? (
        <label className="block max-w-sm space-y-2 text-sm text-stone-200">
          <span>Amount to waive (optional)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 text-white" max={(props.differenceMinor / 100).toFixed(2)} min="0" name="waivedAmount" step="0.01" type="number" />
          <span className="block text-xs text-stone-400">Maximum {formatCurrency(props.differenceMinor, "PHP")}. A customer-facing note is required when waiving an amount.</span>
        </label>
      ) : <input name="waivedAmount" type="hidden" value="0" />}
      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-200">
        <input className="mt-1" required type="checkbox" />
        <span>I reviewed the current and replacement schedules and understand the price-adjustment behavior shown above.</span>
      </label>
      <div aria-live="polite">
        {state.error ? <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{state.error}</p> : null}
        {state.success ? <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">{state.success}</p> : null}
      </div>
      <ConfirmButton />
    </form>
  );
}
