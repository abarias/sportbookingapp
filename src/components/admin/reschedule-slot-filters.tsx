"use client";

type FacilityOption = {
  id: string;
  name: string;
};

export function RescheduleSlotFilters({
  facilities,
  selectedFacilityId,
  selectedDate,
  minDateKey,
  maxDateKey
}: {
  facilities: FacilityOption[];
  selectedFacilityId?: string;
  selectedDate: string;
  minDateKey: string;
  maxDateKey: string;
}) {
  return (
    <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" method="get">
      <label className="space-y-2 text-sm text-stone-200">
        <span>Replacement facility</span>
        <select
          className="h-11 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 text-white"
          defaultValue={selectedFacilityId}
          name="facilityId"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm text-stone-200">
        <span>Replacement date</span>
        <input
          className="h-11 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 text-white"
          defaultValue={selectedDate}
          name="date"
          max={maxDateKey}
          min={minDateKey}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          required
          type="date"
        />
      </label>
      <button className="mt-auto h-11 rounded-full bg-white/10 px-5 text-sm text-white" type="submit">
        Check availability
      </button>
    </form>
  );
}
