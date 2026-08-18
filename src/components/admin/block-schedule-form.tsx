"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { Facility } from "@prisma/client";

import { createBlockedScheduleAction, type BlockScheduleActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

type BlockScheduleFormProps = {
  facilities: Facility[];
  facilityId?: string;
};

const initialState: BlockScheduleActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Saving block..." : "Add block"}</Button>;
}

export function BlockScheduleForm({ facilities, facilityId }: BlockScheduleFormProps) {
  const [state, action] = useActionState(createBlockedScheduleAction, initialState);

  return (
    <form action={action} className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Create blocked schedule</h2>
      <p className="text-sm text-stone-400">
        Blocks support both date range and time range, so you can block a few hours or multiple days as needed.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {facilityId ? <input name="facilityId" type="hidden" value={facilityId} /> : (
          <label className="space-y-2 text-sm text-stone-200">
            <span>Facility</span>
            <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="facilityId" required>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-2 text-sm text-stone-200">
          <span>Title</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue="Maintenance block" maxLength={120} name="title" required />
          {state.fieldErrors?.title ? <p className="text-sm text-rose-300">{state.fieldErrors.title}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="startDate" required type="date" />
          {state.fieldErrors?.startDate ? <p className="text-sm text-rose-300">{state.fieldErrors.startDate}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Reason</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" maxLength={300} name="reason" placeholder="Private event, cleaning, repairs" />
          {state.fieldErrors?.reason ? <p className="text-sm text-rose-300">{state.fieldErrors.reason}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>End date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="endDate" required type="date" />
          {state.fieldErrors?.endDate ? <p className="text-sm text-rose-300">{state.fieldErrors.endDate}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="startTime" required type="time" />
          {state.fieldErrors?.startTime ? <p className="text-sm text-rose-300">{state.fieldErrors.startTime}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>End time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="endTime" required type="time" />
          {state.fieldErrors?.endTime ? <p className="text-sm text-rose-300">{state.fieldErrors.endTime}</p> : null}
        </label>
      </div>
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
