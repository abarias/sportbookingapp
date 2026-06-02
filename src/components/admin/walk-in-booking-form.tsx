"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createWalkInBookingAction, type WalkInBookingActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

type FacilityOption = {
  id: string;
  name: string;
};

const initialState: WalkInBookingActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit">{pending ? "Creating booking..." : "Create walk-in booking"}</Button>;
}

export function WalkInBookingForm({ facilities, maxDateKey, minDateKey }: { facilities: FacilityOption[]; minDateKey: string; maxDateKey: string }) {
  const [state, action] = useActionState(createWalkInBookingAction, initialState);

  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Book for a walk-in customer</h2>
        <p className="mt-1 text-sm text-stone-400">Capture customer details and create a confirmed booking from the admin desk.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Customer name</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="fullName" required />
          {state.fieldErrors?.fullName ? <p className="text-sm text-rose-300">{state.fieldErrors.fullName}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Mobile number</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="phone" placeholder="09171234567" required type="tel" />
          {state.fieldErrors?.phone ? <p className="text-sm text-rose-300">{state.fieldErrors.phone}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Email optional</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="email" placeholder="customer@example.com" type="email" />
          {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Facility</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="facilityId" required>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>{facility.name}</option>
            ))}
          </select>
          {state.fieldErrors?.facilityId ? <p className="text-sm text-rose-300">{state.fieldErrors.facilityId}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" max={maxDateKey} min={minDateKey} name="dateKey" required type="date" />
          {state.fieldErrors?.dateKey ? <p className="text-sm text-rose-300">{state.fieldErrors.dateKey}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="startTime" required step={1800} type="time" />
          {state.fieldErrors?.startTime ? <p className="text-sm text-rose-300">{state.fieldErrors.startTime}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Duration minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={60} max={240} min={30} name="durationMinutes" required step={30} type="number" />
          {state.fieldErrors?.durationMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.durationMinutes}</p> : null}
        </label>
      </div>
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
