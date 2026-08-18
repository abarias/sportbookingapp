"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { Facility, FacilityImage, FacilityOperatingHour, PricingRule } from "@prisma/client";

import { updateFacilityAction, type FacilityActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { FacilityImageManager } from "@/components/admin/facility-image-manager";
import { minutesToTimeInputValue } from "@/lib/time/slots";

type FacilityWithAdminFields = Facility & {
  images: FacilityImage[];
  operatingHours: FacilityOperatingHour[];
  pricingRules: PricingRule[];
  bookings: Array<{ id: string }>;
};

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const initialState: FacilityActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Saving changes..." : "Save changes"}</Button>;
}

export function FacilityForm({ facility }: { facility: FacilityWithAdminFields }) {
  const activePricing = facility.pricingRules[0];
  const [state, action] = useActionState(updateFacilityAction, initialState);

  return (
    <form action={action} className="space-y-6" id={`facility-${facility.id}`}>
      <input name="facilityId" type="hidden" value={facility.id} />
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Facility details</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{facility.name}</h2>
          <p className="mt-1 text-sm text-stone-400">{facility.type.replaceAll("_", " ")} · {facility.bookings.length} confirmed bookings</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-300">
          <input defaultChecked={facility.isEnabled} name="isEnabled" type="checkbox" />
          Available for customer bookings
        </label>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
        <div>
          <h3 className="font-semibold text-white">General information</h3>
          <p className="mt-1 text-sm text-stone-400">Keep the customer-facing name and description clear and accurate.</p>
        </div>
        <label className="block space-y-2 text-sm text-stone-200">
          <span>Name</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.name} maxLength={120} name="name" required />
          {state.fieldErrors?.name ? <p className="text-sm text-rose-300">{state.fieldErrors.name}</p> : null}
        </label>
        <label className="block space-y-2 text-sm text-stone-200">
          <span>Description</span>
          <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" defaultValue={facility.description} maxLength={1000} name="description" required />
          {state.fieldErrors?.description ? <p className="text-sm text-rose-300">{state.fieldErrors.description}</p> : null}
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
        <div>
          <h3 className="font-semibold text-white">Pricing</h3>
          <p className="mt-1 text-sm text-stone-400">All customer bookings use hourly increments with a one-hour minimum.</p>
        </div>
        <label className="block max-w-sm space-y-2 text-sm text-stone-200">
          <span>Price per hour (PHP)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={((activePricing?.amountMinor ?? 0) / 100).toFixed(2)} min="0" name="amount" required step="0.01" type="number" />
          {state.fieldErrors?.amount ? <p className="text-sm text-rose-300">{state.fieldErrors.amount}</p> : null}
        </label>
      </section>

      <FacilityImageManager key={`${facility.id}-${facility.updatedAt.toISOString()}`} facilityName={facility.name} initialImageUrls={facility.images.map((image) => image.url)} />

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
        <div>
          <h3 className="font-semibold text-white">Operating hours</h3>
          <p className="mt-1 text-sm text-stone-400">Set the local operating window. Closed days cannot be booked.</p>
        </div>
        <div className="space-y-3">
          {dayLabels.map((label, dayOfWeek) => {
            const hour = facility.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);

            return (
              <div key={label} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
                <div className="text-sm font-medium text-white">{label}</div>
                <label className="space-y-1 text-sm text-stone-300">
                  <span>Open</span>
                  <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={minutesToTimeInputValue(hour?.opensAtMinutes ?? 480)} name={`opensAtMinutes_${dayOfWeek}`} required step={1800} type="time" />
                </label>
                <label className="space-y-1 text-sm text-stone-300">
                  <span>Close</span>
                  <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={minutesToTimeInputValue(hour?.closesAtMinutes ?? 1320)} name={`closesAtMinutes_${dayOfWeek}`} required step={1800} type="time" />
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-300">
                  <input defaultChecked={hour?.isClosed ?? false} name={`isClosed_${dayOfWeek}`} type="checkbox" />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
        <div>
          <h3 className="font-semibold text-white">Cancellation settings</h3>
          <p className="mt-1 text-sm text-stone-400">Override the global customer cancellation policy for this facility when needed.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-stone-200">
            <span>Cancellation policy</span>
            <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.cancellationEnabledOverride === null ? "inherit" : facility.cancellationEnabledOverride ? "enabled" : "disabled"} name="cancellationEnabledOverride">
              <option value="inherit">Inherit global setting</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-stone-200">
            <span>Cancellation window override (hours)</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.cancellationWindowHoursOverride ?? ""} min={1} name="cancellationWindowHoursOverride" placeholder="Inherit global" type="number" />
            {state.fieldErrors?.cancellationWindowHoursOverride ? <p className="text-sm text-rose-300">{state.fieldErrors.cancellationWindowHoursOverride}</p> : null}
          </label>
        </div>
      </section>

      {state.fieldErrors?.imageUrls ? <p className="text-sm text-rose-300">{state.fieldErrors.imageUrls}</p> : null}
      {state.fieldErrors?.operatingHours ? <p className="text-sm text-rose-300">{state.fieldErrors.operatingHours}</p> : null}
      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
