"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createFacilityAction, type FacilityActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { minutesToTimeInputValue } from "@/lib/time/slots";

const initialState: FacilityActionState = {};
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Creating..." : "Create Facility"}</Button>;
}

export function FacilityCreateForm() {
  const [state, action] = useActionState(createFacilityAction, initialState);

  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Add new facility</h2>
        <p className="mt-1 text-sm text-amber-100/80">Create a new bookable court with pricing, images, and operating hours.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Name</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" maxLength={120} name="name" required />
          {state.fieldErrors?.name ? <p className="text-sm text-rose-300">{state.fieldErrors.name}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Slug</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="slug" placeholder="court-name" />
          {state.fieldErrors?.slug ? <p className="text-sm text-rose-300">{state.fieldErrors.slug}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Type</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="type" required>
            <option value="BASKETBALL_WHOLE">Whole basketball court</option>
            <option value="BASKETBALL_HALF">Half basketball court</option>
            <option value="PICKLEBALL">Pickleball court</option>
            <option value="BADMINTON">Badminton court</option>
          </select>
          {state.fieldErrors?.type ? <p className="text-sm text-rose-300">{state.fieldErrors.type}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Enabled</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="isEnabled" defaultValue="true">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Description</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" maxLength={1000} name="description" required />
          {state.fieldErrors?.description ? <p className="text-sm text-rose-300">{state.fieldErrors.description}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Price (PHP per hour)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" min="0" name="amount" required step="0.01" type="number" />
          {state.fieldErrors?.amount ? <p className="text-sm text-rose-300">{state.fieldErrors.amount}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Minimum minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={60} max={480} min={60} name="minimumMinutes" required step={60} type="number" />
          {state.fieldErrors?.minimumMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.minimumMinutes}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Slot interval minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={30} max={240} min={30} name="slotIntervalMinutes" required step={30} type="number" />
          {state.fieldErrors?.slotIntervalMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.slotIntervalMinutes}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Cancellation window override hours</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" min={1} name="cancellationWindowHoursOverride" placeholder="Inherit global" type="number" />
          {state.fieldErrors?.cancellationWindowHoursOverride ? <p className="text-sm text-rose-300">{state.fieldErrors.cancellationWindowHoursOverride}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Cancellation policy override</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="cancellationEnabledOverride" defaultValue="inherit">
            <option value="inherit">Inherit global setting</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Upload images</span>
          <input accept="image/*" className="block w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-950" multiple name="imageFiles" type="file" />
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Image URLs, one per line</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" name="imageUrls" />
          {state.fieldErrors?.imageUrls ? <p className="text-sm text-rose-300">{state.fieldErrors.imageUrls}</p> : null}
        </label>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-300">Operating hours</h3>
        <div className="grid gap-3">
          {dayLabels.map((label, dayOfWeek) => (
            <div key={label} className="grid gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 md:grid-cols-[100px_1fr_1fr_120px]">
              <div className="text-sm font-medium text-white">{label}</div>
              <label className="space-y-1 text-sm text-stone-300">
                <span>Open</span>
                <input
                  className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white"
                  defaultValue={minutesToTimeInputValue(480)}
                  name={`opensAtMinutes_${dayOfWeek}`}
                  required
                  step={1800}
                  type="time"
                />
              </label>
              <label className="space-y-1 text-sm text-stone-300">
                <span>Close</span>
                <input
                  className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white"
                  defaultValue={minutesToTimeInputValue(1320)}
                  name={`closesAtMinutes_${dayOfWeek}`}
                  required
                  step={1800}
                  type="time"
                />
              </label>
              <label className="flex items-center gap-2 self-end text-sm text-stone-300">
                <input name={`isClosed_${dayOfWeek}`} type="checkbox" />
                Closed
              </label>
            </div>
          ))}
        </div>
        {state.fieldErrors?.operatingHours ? <p className="text-sm text-rose-300">{state.fieldErrors.operatingHours}</p> : null}
      </div>
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <SubmitButton />
    </form>
  );
}
