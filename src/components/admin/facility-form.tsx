"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { Facility, FacilityImage, FacilityOperatingHour, PricingRule } from "@prisma/client";

import { updateFacilityAction, type FacilityActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { minutesToTimeInputValue } from "@/lib/time/slots";

type FacilityWithAdminFields = Facility & {
  images: FacilityImage[];
  operatingHours: FacilityOperatingHour[];
  pricingRules: PricingRule[];
  bookings: Array<{ id: string }>;
};

type FacilityFormProps = {
  facility: FacilityWithAdminFields;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const initialState: FacilityActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Saving..." : "Save Facility"}</Button>;
}

export function FacilityForm({ facility }: FacilityFormProps) {
  const activePricing = facility.pricingRules[0];
  const [state, action] = useActionState(updateFacilityAction, initialState);

  return (
    <form action={action} className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <input name="facilityId" type="hidden" value={facility.id} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{facility.name}</h2>
          <p className="text-sm text-stone-400">{facility.type.replaceAll("_", " ")} • {facility.bookings.length} confirmed bookings</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-300">
          <label className="flex items-center gap-2">
            <input defaultChecked={facility.isEnabled} name="isEnabled" type="checkbox" />
            Enabled
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Name</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.name} maxLength={120} name="name" required />
          {state.fieldErrors?.name ? <p className="text-sm text-rose-300">{state.fieldErrors.name}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Slot interval minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.slotIntervalMinutes} max={240} min={30} name="slotIntervalMinutes" required step={30} type="number" />
          {state.fieldErrors?.slotIntervalMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.slotIntervalMinutes}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Description</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" defaultValue={facility.description} maxLength={1000} name="description" required />
          {state.fieldErrors?.description ? <p className="text-sm text-rose-300">{state.fieldErrors.description}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Price (PHP)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={((activePricing?.amountMinor ?? 0) / 100).toFixed(2)} min="0" name="amount" required step="0.01" type="number" />
          {state.fieldErrors?.amount ? <p className="text-sm text-rose-300">{state.fieldErrors.amount}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Minimum minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={Math.max(activePricing?.minimumMinutes ?? 60, 60)} max={480} min={60} name="minimumMinutes" required step={60} type="number" />
          {state.fieldErrors?.minimumMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.minimumMinutes}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Upload additional images</span>
          <input accept="image/*" className="block w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-950" multiple name="imageFiles" type="file" />
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Image URLs, one per line</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white"
            defaultValue={facility.images.map((image) => image.url).join("\n")}
            name="imageUrls"
            required
          />
          {state.fieldErrors?.imageUrls ? <p className="text-sm text-rose-300">{state.fieldErrors.imageUrls}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Cancellation policy override</span>
          <select
            className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white"
            defaultValue={
              facility.cancellationEnabledOverride === null
                ? "inherit"
                : facility.cancellationEnabledOverride
                  ? "enabled"
                  : "disabled"
            }
            name="cancellationEnabledOverride"
          >
            <option value="inherit">Inherit global setting</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Cancellation window override hours</span>
          <input
            className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white"
            defaultValue={facility.cancellationWindowHoursOverride ?? ""}
            min={1}
            name="cancellationWindowHoursOverride"
            placeholder="Inherit global"
            type="number"
          />
          {state.fieldErrors?.cancellationWindowHoursOverride ? <p className="text-sm text-rose-300">{state.fieldErrors.cancellationWindowHoursOverride}</p> : null}
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-300">Operating hours</h3>
        <div className="grid gap-3">
          {dayLabels.map((label, dayOfWeek) => {
            const hour = facility.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);

            return (
              <div key={label} className="grid gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 md:grid-cols-[100px_1fr_1fr_120px]">
                <div className="text-sm font-medium text-white">{label}</div>
                <label className="space-y-1 text-sm text-stone-300">
                  <span>Open</span>
                  <input
                    className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white"
                    defaultValue={minutesToTimeInputValue(hour?.opensAtMinutes ?? 480)}
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
                    defaultValue={minutesToTimeInputValue(hour?.closesAtMinutes ?? 1320)}
                    name={`closesAtMinutes_${dayOfWeek}`}
                    required
                    step={1800}
                    type="time"
                  />
                </label>
                <label className="flex items-center gap-2 self-end text-sm text-stone-300">
                  <input defaultChecked={hour?.isClosed ?? false} name={`isClosed_${dayOfWeek}`} type="checkbox" />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {state.fieldErrors?.operatingHours ? <p className="text-sm text-rose-300">{state.fieldErrors.operatingHours}</p> : null}
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}

      <SubmitButton />
    </form>
  );
}
