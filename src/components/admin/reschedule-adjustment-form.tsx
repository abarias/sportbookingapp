"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { resolveRescheduleAdjustmentAction, type RescheduleActionState } from "@/features/rescheduling/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Recording..." : "Record resolution"}</button>;
}

export function RescheduleAdjustmentForm({ rescheduleId, maximumAmount }: { rescheduleId: string; maximumAmount: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(maximumAmount);
  const [state, action] = useActionState(resolveRescheduleAdjustmentAction, {} as RescheduleActionState);
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <form action={action} className="mt-4 grid gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 md:grid-cols-2">
      <input name="rescheduleId" type="hidden" value={rescheduleId} />
      <label className="space-y-2 text-sm text-stone-200"><span>Resolution</span><select className="h-11 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-white" name="method" onChange={(event) => setAmount(event.target.value === "NO_REFUND" ? "0.00" : maximumAmount)} required><option value="MANUAL_REFUND">Manual refund completed</option><option value="CUSTOMER_CREDIT">Customer credit recorded</option><option value="NO_REFUND">No refund by approved policy</option><option value="OTHER">Other documented resolution</option></select></label>
      <label className="space-y-2 text-sm text-stone-200"><span>Resolution amount</span><input className="h-11 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-white" max={maximumAmount} min="0" name="amount" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /></label>
      <label className="space-y-2 text-sm text-stone-200"><span>External reference (optional)</span><input className="h-11 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-white" maxLength={120} name="reference" /></label>
      <label className="space-y-2 text-sm text-stone-200"><span>Resolution notes</span><textarea className="min-h-20 w-full rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-white" maxLength={1000} name="note" required /></label>
      <div className="md:col-span-2" aria-live="polite">{state.error ? <p className="mb-3 text-sm text-rose-200">{state.error}</p> : null}{state.success ? <p className="mb-3 text-sm text-emerald-200">{state.success}</p> : null}<SubmitButton /></div>
    </form>
  );
}
