"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  rejectPaymentAction,
  requestPaymentActionRequiredAction,
  verifyPaymentAction,
  type PaymentReviewActionState
} from "@/features/admin/actions";

const initialState: PaymentReviewActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15 disabled:opacity-60" disabled={pending} type="submit">
      {pending ? "Saving..." : label}
    </button>
  );
}

export function PaymentReviewForm({ paymentId }: { paymentId: string }) {
  const [verifyState, verifyAction] = useActionState(verifyPaymentAction, initialState);
  const [rejectState, rejectAction] = useActionState(rejectPaymentAction, initialState);
  const [actionState, actionRequiredAction] = useActionState(requestPaymentActionRequiredAction, initialState);
  const state = verifyState.success || verifyState.error ? verifyState : rejectState.success || rejectState.error ? rejectState : actionState;

  return (
    <div className="space-y-3">
      <form action={verifyAction} className="space-y-3">
        <input name="paymentId" type="hidden" value={paymentId} />
        <textarea className="min-h-20 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white" name="reviewNote" placeholder="Optional verification note" />
        <SubmitButton label="Confirm payment" />
      </form>
      <form action={actionRequiredAction} className="space-y-3">
        <input name="paymentId" type="hidden" value={paymentId} />
        <textarea className="min-h-20 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white" name="reviewNote" placeholder="Instructions for customer" required />
        <SubmitButton label="Request new proof" />
      </form>
      <form action={rejectAction} className="space-y-3">
        <input name="paymentId" type="hidden" value={paymentId} />
        <textarea className="min-h-20 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white" name="reviewNote" placeholder="Rejection reason" required />
        <SubmitButton label="Reject payment" />
      </form>
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
    </div>
  );
}
