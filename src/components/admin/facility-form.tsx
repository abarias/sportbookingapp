"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import type { Facility, FacilityImage, FacilityOperatingHour, PricingRule } from "@prisma/client";

import { updateFacilityAction, type FacilityActionState } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { FacilityImageManager } from "@/components/admin/facility-image-manager";
import { minutesToTimeLabel } from "@/lib/time/slots";

type FacilityWithAdminFields = Facility & {
  images: FacilityImage[];
  operatingHours: FacilityOperatingHour[];
  pricingRules: PricingRule[];
  bookings: Array<{ id: string }>;
};

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const openingTimeOptions = Array.from({ length: 24 }, (_, index) => index * 60);
const closingTimeOptions = Array.from({ length: 24 }, (_, index) => (index + 1) * 60);
const initialState: FacilityActionState = {};

function SubmitButton({ section }: { section: "details" | "images" | "schedule" }) {
  const { pending } = useFormStatus();

  return <Button disabled={pending} name="saveSection" type="submit" value={section}>{pending ? "Saving changes..." : "Save changes"}</Button>;
}

function SaveStatus({ state, section }: { state: FacilityActionState; section: "details" | "images" | "schedule" }) {
  if (state.section !== section || (!state.message && !state.success)) {
    return null;
  }

  return <p className={`rounded-xl border p-3 text-sm ${state.message ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>{state.message ?? state.success}</p>;
}

export function FacilityForm({ facility, canManageContent, canManageFacilities, canManagePhotos, canManagePricing }: { facility: FacilityWithAdminFields; canManageContent: boolean; canManageFacilities: boolean; canManagePhotos: boolean; canManagePricing: boolean }) {
  const router = useRouter();
  const activePricing = facility.pricingRules[0];
  const [state, action] = useActionState(updateFacilityAction, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="space-y-6" id={`facility-${facility.id}`}>
      <input name="facilityId" type="hidden" value={facility.id} />
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Facility details</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{facility.name}</h2>
          <p className="mt-1 text-sm text-stone-400">{facility.type.replaceAll("_", " ")} · {facility.bookings.length} confirmed bookings</p>
        </div>
        {canManageFacilities ? <label className="flex items-center gap-2 text-sm text-stone-300">
          <input defaultChecked={facility.isEnabled} name="isEnabled" type="checkbox" />
          Available for customer bookings
        </label> : null}
      </div>

      {canManageContent ? <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
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
      </section> : null}

      {canManagePricing ? <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
        <div>
          <h3 className="font-semibold text-white">Pricing</h3>
          <p className="mt-1 text-sm text-stone-400">All customer bookings use hourly increments with a one-hour minimum.</p>
        </div>
        <label className="block max-w-sm space-y-2 text-sm text-stone-200">
          <span>Price per hour (PHP)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={((activePricing?.amountMinor ?? 0) / 100).toFixed(2)} min="0.01" name="amount" required step="0.01" type="number" />
          <span className="mt-1 block text-xs text-stone-500">Fallback base rate per hour, exclusive of VAT. Schedule overrides are managed under Pricing.</span>
          {state.fieldErrors?.amount ? <p className="text-sm text-rose-300">{state.fieldErrors.amount}</p> : null}
        </label>
      </section> : null}

      {canManageContent || canManagePricing || canManageFacilities ? <div className="flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
        <SaveStatus section="details" state={state} />
        <SubmitButton section="details" />
      </div> : null}

      {canManagePhotos ? <><FacilityImageManager key={`${facility.id}-${facility.images.map((image) => image.url).join("|")}`} facilityName={facility.name} initialImageUrls={facility.images.map((image) => image.url)} />

      <div className="flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
        {state.section === "images" && state.fieldErrors?.imageUrls ? <p className="text-sm text-rose-300">{state.fieldErrors.imageUrls}</p> : null}
        <SaveStatus section="images" state={state} />
        <SubmitButton section="images" />
      </div></> : null}

      {canManageFacilities ? <><div key={facility.updatedAt.toISOString()} className="space-y-6">
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
                    <select className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={hour?.opensAtMinutes ?? 480} name={`opensAtMinutes_${dayOfWeek}`} required>
                      {openingTimeOptions.map((minutes) => <option key={minutes} value={minutes}>{minutesToTimeLabel(minutes)}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-stone-300">
                    <span>Close</span>
                    <select className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={hour?.closesAtMinutes ?? 1320} name={`closesAtMinutes_${dayOfWeek}`} required>
                      {closingTimeOptions.map((minutes) => <option key={minutes} value={minutes}>{minutesToTimeLabel(minutes)}{minutes === 1440 ? " (midnight)" : ""}</option>)}
                    </select>
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
      </div>

      <div className="flex flex-col items-end gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
        {state.section === "schedule" && state.fieldErrors?.operatingHours ? <p className="text-sm text-rose-300">{state.fieldErrors.operatingHours}</p> : null}
        <SaveStatus section="schedule" state={state} />
        <SubmitButton section="schedule" />
      </div></> : null}
    </form>
  );
}
