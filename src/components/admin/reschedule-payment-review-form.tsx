"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { rejectReschedulePaymentAction, type RescheduleActionState, verifyReschedulePaymentAction } from "@/features/rescheduling/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Saving..." : label}</button>;
}

export function ReschedulePaymentReviewForm({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [verifyState, verifyAction] = useActionState(verifyReschedulePaymentAction, {} as RescheduleActionState);
  const [rejectState, rejectAction] = useActionState(rejectReschedulePaymentAction, {} as RescheduleActionState);
  const state = verifyState.success || verifyState.error ? verifyState : rejectState;
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <div className="space-y-5">
      <form action={verifyAction} className="space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
        <input name="reschedulePaymentId" type="hidden" value={paymentId} />
        <textarea className="min-h-20 w-full rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-white" maxLength={1000} name="reviewNote" placeholder="Optional verification note" />
        <SubmitButton label="Verify and complete reschedule" />
      </form>
      <form action={rejectAction} className="space-y-3 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4" onSubmit={(event) => { if (!window.confirm("Reject this additional payment proof? The original booking will remain valid.")) event.preventDefault(); }}>
        <input name="reschedulePaymentId" type="hidden" value={paymentId} />
        <textarea className="min-h-20 w-full rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-white" maxLength={1000} name="reviewNote" placeholder="Rejection reason" required />
        <SubmitButton label="Reject proof" />
      </form>
      <div aria-live="polite">{state.error ? <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{state.error}</p> : null}{state.success ? <p className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">{state.success}</p> : null}</div>
    </div>
  );
}
