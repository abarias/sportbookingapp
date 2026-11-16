"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Facility } from "@prisma/client";

import { createBlockedScheduleAction, type BlockScheduleActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { minutesToTimeLabel } from "@/lib/time/slots";

type BlockScheduleFormProps = {
  facilities: Facility[];
  facilityId?: string;
};

const initialState: BlockScheduleActionState = {};
const startTimeOptions = Array.from({ length: 24 }, (_, index) => index * 60);
const endTimeOptions = Array.from({ length: 24 }, (_, index) => (index + 1) * 60);

function timeOptionValue(minutes: number) {
  if (minutes === 1440) return "24:00";

  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:00`;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Saving block..." : "Add block"}</Button>;
}

export function BlockScheduleForm({ facilities, facilityId }: BlockScheduleFormProps) {
  const [state, action] = useActionState(createBlockedScheduleAction, initialState);
  const [allDay, setAllDay] = useState(false);

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
          <span>Reason</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" maxLength={300} name="reason" placeholder="Private event, cleaning, repairs" />
          {state.fieldErrors?.reason ? <p className="text-sm text-rose-300">{state.fieldErrors.reason}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="startDate" required type="date" />
          {state.fieldErrors?.startDate ? <p className="text-sm text-rose-300">{state.fieldErrors.startDate}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>End date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="endDate" required type="date" />
          {state.fieldErrors?.endDate ? <p className="text-sm text-rose-300">{state.fieldErrors.endDate}</p> : null}
        </label>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-white/10 bg-stone-900/50 p-3 text-sm text-stone-200 md:col-span-2">
          <input checked={allDay} name="allDay" onChange={(event) => setAllDay(event.target.checked)} type="checkbox" />
          <span>
            <span className="block font-medium text-white">All day</span>
            <span className="block text-xs text-stone-400">Block the entire day from the start date through the end date.</span>
          </span>
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start time</span>
          <select aria-disabled={allDay} className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white disabled:cursor-not-allowed disabled:opacity-50" defaultValue="08:00" disabled={allDay} name="startTime" required>
            {startTimeOptions.map((minutes) => <option key={minutes} value={timeOptionValue(minutes)}>{minutesToTimeLabel(minutes)}</option>)}
          </select>
          {allDay ? <input name="startTime" type="hidden" value="00:00" /> : null}
          {state.fieldErrors?.startTime ? <p className="text-sm text-rose-300">{state.fieldErrors.startTime}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>End time</span>
          <select aria-disabled={allDay} className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white disabled:cursor-not-allowed disabled:opacity-50" defaultValue="18:00" disabled={allDay} name="endTime" required>
            {endTimeOptions.map((minutes) => <option key={minutes} value={timeOptionValue(minutes)}>{minutesToTimeLabel(minutes)}{minutes === 1440 ? " (midnight)" : ""}</option>)}
          </select>
          {allDay ? <input name="endTime" type="hidden" value="24:00" /> : null}
          {state.fieldErrors?.endTime ? <p className="text-sm text-rose-300">{state.fieldErrors.endTime}</p> : null}
        </label>
      </div>
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
