"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteBlockedScheduleAction, type DeleteBlockScheduleActionState } from "@/features/admin/actions";

const initialState: DeleteBlockScheduleActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-stone-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Deleting..." : "Delete block"}
    </button>
  );
}

export function DeleteBlockScheduleButton({ blockId }: { blockId: string }) {
  const [state, action] = useActionState(deleteBlockedScheduleAction, initialState);

  return (
    <form action={action} className="space-y-2">
      <input name="blockId" type="hidden" value={blockId} />
      <SubmitButton />
      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}
    </form>
  );
}
