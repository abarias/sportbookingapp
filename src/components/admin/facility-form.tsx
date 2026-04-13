import type { Facility, FacilityImage, FacilityOperatingHour, PricingRule } from "@prisma/client";

import { updateFacilityAction } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

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

export function FacilityForm({ facility }: FacilityFormProps) {
  const activePricing = facility.pricingRules[0];

  return (
    <form action={updateFacilityAction} className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
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
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.name} name="name" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Slot interval minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={facility.slotIntervalMinutes} min={30} name="slotIntervalMinutes" step={30} type="number" />
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Description</span>
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white" defaultValue={facility.description} name="description" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Price (PHP)</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={((activePricing?.amountMinor ?? 0) / 100).toFixed(2)} min="0" name="amount" step="0.01" type="number" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Minimum minutes</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue={activePricing?.minimumMinutes ?? 30} min={30} name="minimumMinutes" step={30} type="number" />
        </label>
        <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
          <span>Image URLs, one per line</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white"
            defaultValue={facility.images.map((image) => image.url).join("\n")}
            name="imageUrls"
          />
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
                  <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={hour?.opensAtMinutes ?? 480} name={`opensAtMinutes_${dayOfWeek}`} type="number" />
                </label>
                <label className="space-y-1 text-sm text-stone-300">
                  <span>Close</span>
                  <input className="h-10 w-full rounded-xl border border-white/10 bg-stone-900/80 px-3 text-white" defaultValue={hour?.closesAtMinutes ?? 1320} name={`closesAtMinutes_${dayOfWeek}`} type="number" />
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

      <Button type="submit">Save Facility</Button>
    </form>
  );
}
