"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitReschedulePaymentProofAction, type RescheduleActionState } from "@/features/rescheduling/actions";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 disabled:opacity-50" disabled={pending} type="submit">{pending ? "Submitting..." : "Submit additional payment proof"}</button>;
}

export function ReschedulePaymentProofForm({ rescheduleId }: { rescheduleId: string }) {
  const [state, action] = useActionState(submitReschedulePaymentProofAction, {} as RescheduleActionState);
  const [fileError, setFileError] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6" onSubmit={(event) => { const input = event.currentTarget.elements.namedItem("proofImage"); const file = input instanceof HTMLInputElement ? input.files?.[0] : null; if (file && file.size > MAX_FILE_SIZE) { event.preventDefault(); setFileError("Payment proof image must be 5MB or smaller."); } }}>
      <input name="rescheduleId" type="hidden" value={rescheduleId} />
      <div><h2 className="text-lg font-semibold text-white">Submit proof for the additional amount</h2><p className="mt-1 text-sm text-stone-400">This proof applies only to the rescheduling adjustment. Your original confirmed booking remains active until staff verifies it.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200"><span>Payment method</span><select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 text-white" name="method" required><option value="manual_gcash">GCash transfer</option><option value="manual_bank_transfer">Bank transfer</option></select></label>
        <label className="space-y-2 text-sm text-stone-200"><span>Transfer reference number</span><input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 text-white" maxLength={120} name="externalReference" required /></label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2"><span>Receipt screenshot or image</span><input accept="image/*" className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white" name="proofImage" onChange={(event) => { const file = event.currentTarget.files?.[0]; setFileError(file && file.size > MAX_FILE_SIZE ? "Payment proof image must be 5MB or smaller." : null); }} required type="file" /><span className="block text-xs text-stone-400">Accepted image uploads up to 5MB.</span></label>
      </div>
      <div aria-live="polite">{fileError ? <p className="text-sm text-rose-200">{fileError}</p> : null}{state.error ? <p className="text-sm text-rose-200">{state.error}</p> : null}{state.success ? <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{state.success}</p> : null}</div>
      {!state.success ? <SubmitButton /> : null}
    </form>
  );
}
