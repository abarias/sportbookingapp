"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createFacilityAction, type FacilityActionState } from "@/features/admin/actions";
import { FacilityImageManager } from "@/components/admin/facility-image-manager";
import { Button } from "@/components/ui/button";
import { minutesToTimeInputValue } from "@/lib/time/slots";

const initialState: FacilityActionState = {};
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type HourValue = {
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Creating..." : "Create facility"}</Button>;
}

export function FacilityCreateForm() {
  const [state, action] = useActionState(createFacilityAction, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("BASKETBALL_WHOLE");
  const [isEnabled, setIsEnabled] = useState("true");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [cancellationWindow, setCancellationWindow] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("inherit");
  const [hours, setHours] = useState<HourValue[]>(() =>
    Array.from({ length: 7 }, () => ({
      opensAt: minutesToTimeInputValue(480),
      closesAt: minutesToTimeInputValue(1320),
      isClosed: false
    }))
  );

  function updateHour(dayOfWeek: number, values: Partial<HourValue>) {
    setHours((current) => current.map((hour, index) => (index === dayOfWeek ? { ...hour, ...values } : hour)));
  }

  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Add a facility</h2>
        <p className="mt-1 text-sm text-amber-100/80">Create a new bookable court or activity with pricing, images, and operating hours.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Name</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" maxLength={120} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
          {state.fieldErrors?.name ? <p className="text-sm text-rose-300">{state.fieldErrors.name}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Slug</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="slug" onChange={(event) => setSlug(event.target.value)} placeholder="court-name" value={slug} />
          {state.fieldErrors?.slug ? <p className="text-sm text-rose-300">{state.fieldErrors.slug}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Type</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="type" onChange={(event) => setType(event.target.value)} required value={type}>
            <option value="BASKETBALL_WHOLE">Whole basketball court</option>
            <option value="BASKETBALL_HALF">Half basketball court</option>
            <option value="PICKLEBALL">Pickleball court</option>
            <option value="BADMINTON">Badminton court</option>
            <option value="OTHER">Other</option>
          </select>
          {state.fieldErrors?.type ? <p className="text-sm text-rose-300">{state.fieldErrors.type}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Availability</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="isEnabled" onChange={(event) => setIsEnabled(event.target.value)} value={isEnabled}>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Description</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" maxLength={1000} name="description" onChange={(event) => setDescription(event.target.value)} required value={description} />
          {state.fieldErrors?.description ? <p className="text-sm text-rose-300">{state.fieldErrors.description}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Price (PHP per hour)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" min="0" name="amount" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} />
          {state.fieldErrors?.amount ? <p className="text-sm text-rose-300">{state.fieldErrors.amount}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Cancellation window override hours</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" min={1} name="cancellationWindowHoursOverride" onChange={(event) => setCancellationWindow(event.target.value)} placeholder="Inherit global" type="number" value={cancellationWindow} />
          {state.fieldErrors?.cancellationWindowHoursOverride ? <p className="text-sm text-rose-300">{state.fieldErrors.cancellationWindowHoursOverride}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Cancellation policy override</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="cancellationEnabledOverride" onChange={(event) => setCancellationPolicy(event.target.value)} value={cancellationPolicy}>
            <option value="inherit">Inherit global setting</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>

      <FacilityImageManager actionState={state} facilityName={name || "New facility"} initialImageUrls={[]} />
      {state.fieldErrors?.imageUrls ? <p className="text-sm text-rose-300">{state.fieldErrors.imageUrls}</p> : null}

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-300">Operating hours</h3>
          <p className="mt-1 text-sm text-stone-400">Set the local operating window. Closed days cannot be booked.</p>
        </div>
        <div className="grid gap-3">
          {dayLabels.map((label, dayOfWeek) => (
            <div key={label} className="grid gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 md:grid-cols-[100px_1fr_1fr_120px]">
              <div className="text-sm font-medium text-white">{label}</div>
              <label className="space-y-1 text-sm text-stone-300">
                <span>Open</span>
                <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" name={`opensAtMinutes_${dayOfWeek}`} required step={1800} type="time" value={hours[dayOfWeek]?.opensAt ?? "08:00"} onChange={(event) => updateHour(dayOfWeek, { opensAt: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm text-stone-300">
                <span>Close</span>
                <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" name={`closesAtMinutes_${dayOfWeek}`} required step={1800} type="time" value={hours[dayOfWeek]?.closesAt ?? "22:00"} onChange={(event) => updateHour(dayOfWeek, { closesAt: event.target.value })} />
              </label>
              <label className="flex items-center gap-2 self-end text-sm text-stone-300">
                <input name={`isClosed_${dayOfWeek}`} type="checkbox" checked={hours[dayOfWeek]?.isClosed ?? false} onChange={(event) => updateHour(dayOfWeek, { isClosed: event.target.checked })} />
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
