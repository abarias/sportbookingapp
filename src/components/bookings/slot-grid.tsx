import { minutesToTimeLabel } from "@/lib/time/slots";
import type { DaySlot } from "@/server/bookings/core";

type SlotGridProps = {
  slots: DaySlot[];
};

export function SlotGrid({ slots }: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-stone-300">
        No slots are available for this date because the facility is closed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
        <span className="rounded-full bg-emerald-400/25 px-3 py-1 text-emerald-200">Available</span>
        <span className="rounded-full bg-rose-400/25 px-3 py-1 text-rose-200">Booked</span>
        <span className="rounded-full bg-amber-400/25 px-3 py-1 text-amber-100">Blocked</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => {
          const toneClass =
            slot.reason === "AVAILABLE"
              ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
              : slot.reason === "BOOKED"
                ? "border-rose-300/50 bg-rose-500/20 text-rose-100"
                : "border-amber-300/50 bg-amber-500/20 text-amber-100";

          return (
            <div key={slot.startMinutes} className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
              <p className="font-medium">
                {minutesToTimeLabel(slot.startMinutes)} - {minutesToTimeLabel(slot.endMinutes)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em]">
                {slot.reason === "AVAILABLE" ? "Available" : slot.reason === "BOOKED" ? "Booked" : "Blocked"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
