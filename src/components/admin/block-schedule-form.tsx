import type { Facility } from "@prisma/client";

import { createBlockedScheduleAction } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

type BlockScheduleFormProps = {
  facilities: Facility[];
};

export function BlockScheduleForm({ facilities }: BlockScheduleFormProps) {
  return (
    <form action={createBlockedScheduleAction} className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Create blocked schedule</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-stone-200">
          <span>Facility</span>
          <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="facilityId">
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Title</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" defaultValue="Maintenance block" name="title" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Date</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="date" type="date" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Reason</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="reason" placeholder="Private event, cleaning, repairs" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>Start time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="startTime" type="time" />
        </label>
        <label className="space-y-2 text-sm text-stone-200">
          <span>End time</span>
          <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="endTime" type="time" />
        </label>
      </div>
      <Button type="submit">Add block</Button>
    </form>
  );
}
