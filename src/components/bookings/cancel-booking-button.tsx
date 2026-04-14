"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { cancelBookingAction, type CancelBookingActionState } from "@/features/bookings/actions";

const initialState: CancelBookingActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-full border border-rose-400/30 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Cancelling..." : "Cancel booking"}
    </button>
  );
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action] = useActionState(cancelBookingAction, initialState);

  return (
    <form action={action} className="space-y-2">
      <input name="bookingId" type="hidden" value={bookingId} />
      <SubmitButton />
      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}
    </form>
  );
}
