"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createBookingAction, type BookingActionState } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";
import { minutesToTimeLabel } from "@/lib/time/slots";
import type { DaySlot } from "@/server/bookings/core";

type BookingPanelProps = {
  facilityId: string;
  facilitySlug: string;
  dateKey: string;
  slotIntervalMinutes: number;
  slots: DaySlot[];
  isAuthenticated: boolean;
};

const initialState: BookingActionState = {};
const durationOptions = [30, 60, 90, 120];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={disabled || pending} type="submit">
      {pending ? "Creating hold..." : "Reserve & Pay"}
    </Button>
  );
}

export function BookingPanel({
  facilityId,
  facilitySlug,
  dateKey,
  slotIntervalMinutes,
  slots,
  isAuthenticated
}: BookingPanelProps) {
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState(createBookingAction, initialState);

  const startOptions = useMemo(() => {
    const stepsRequired = durationMinutes / slotIntervalMinutes;

    return slots.filter((slot, index) => {
      const candidateSlots = slots.slice(index, index + stepsRequired);
      return (
        candidateSlots.length === stepsRequired &&
        candidateSlots.every((candidate) => candidate.isAvailable) &&
        slot.startMinutes === candidateSlots[0]?.startMinutes
      );
    });
  }, [durationMinutes, slotIntervalMinutes, slots]);

  const [startMinutes, setStartMinutes] = useState<number | null>(startOptions[0]?.startMinutes ?? null);

  const availableCount = slots.filter((slot) => slot.isAvailable).length;

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Book this facility</p>
        <p className="text-sm text-stone-300">Sign in to reserve an available slot and complete your booking online.</p>
        <Button asChild className="w-full">
          <Link href={`/login?callbackUrl=/facilities/${facilitySlug}`}>Sign in to book</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <input name="facilityId" type="hidden" value={facilityId} />
      <input name="facilitySlug" type="hidden" value={facilitySlug} />
      <input name="dateKey" type="hidden" value={dateKey} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />

      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Create booking</p>
        <p className="text-sm text-stone-300">{availableCount} open half-hour slots remain on this date.</p>
        <p className="text-xs text-amber-200">Click Reserve & Pay to hold this slot while you submit payment proof.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-200" htmlFor="durationMinutes">
          Duration
        </label>
        <select
          className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white"
          id="durationMinutes"
          name="durationMinutes"
          onChange={(event) => {
            const nextDuration = Number.parseInt(event.target.value, 10);
            setDurationMinutes(nextDuration);

            const nextStart = slots.find((slot, index) => {
              const stepsRequired = nextDuration / slotIntervalMinutes;
              const candidateSlots = slots.slice(index, index + stepsRequired);
              return candidateSlots.length === stepsRequired && candidateSlots.every((candidate) => candidate.isAvailable);
            });

            setStartMinutes(nextStart?.startMinutes ?? null);
          }}
          required
          value={durationMinutes}
        >
          {durationOptions.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
        {state.fieldErrors?.durationMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.durationMinutes}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-200" htmlFor="startMinutes">
          Start time
        </label>
        <select
          className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white"
          id="startMinutes"
          name="startMinutes"
          onChange={(event) => setStartMinutes(Number.parseInt(event.target.value, 10))}
          required
          value={startMinutes ?? ""}
        >
          {startOptions.length === 0 ? <option value="">No start times available for this duration</option> : null}
          {startOptions.map((slot) => (
            <option key={slot.startMinutes} value={slot.startMinutes}>
              {minutesToTimeLabel(slot.startMinutes)}
            </option>
          ))}
        </select>
        {state.fieldErrors?.startMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.startMinutes}</p> : null}
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}

      <SubmitButton disabled={startOptions.length === 0 || startMinutes === null} />

      <p className="text-xs leading-6 text-stone-400">Selecting a time does not hold the slot until you click Reserve & Pay.</p>
    </form>
  );
}
