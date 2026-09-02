"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

type BookingDateSelectorProps = {
  dateKey: string;
  minDateKey: string;
  maxDateKey: string;
  replaceCartItemId?: string;
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateValue(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  const monthLabel = month ? monthLabels[Number(month) - 1] : undefined;

  return monthLabel && day ? `${monthLabel} ${Number(day)}, ${year}` : dateKey;
}

export function BookingDateSelector({ dateKey, minDateKey, maxDateKey, replaceCartItemId }: BookingDateSelectorProps) {
  const [selectedDate, setSelectedDate] = useState(dateKey);

  return (
    <form className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      {replaceCartItemId ? <input name="replaceCartItem" type="hidden" value={replaceCartItemId} /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <label className="text-sm font-medium text-stone-200" htmlFor="date">
          Booking date
        </label>
        <div className="relative isolate min-w-0">
          <div aria-hidden="true" className="booking-date-display flex h-11 w-full max-w-full min-w-0 items-center rounded-2xl border border-white/10 bg-stone-900/80 px-3 pr-11 text-base leading-6 text-white sm:px-4">
            <span>{formatDateValue(selectedDate)}</span>
          </div>
          <input
            className="booking-date-input absolute inset-0 z-20 h-full w-full cursor-pointer"
            onChange={(event) => {
              setSelectedDate(event.currentTarget.value);
              event.currentTarget.form?.requestSubmit();
            }}
            value={selectedDate}
            id="date"
            max={maxDateKey}
            min={minDateKey}
            name="date"
            onClick={(event) => event.currentTarget.showPicker?.()}
            required
            type="date"
          />
          <span
            aria-hidden="true"
            className="booking-date-icon pointer-events-none z-30 flex items-center text-stone-400"
            style={{ position: "absolute", top: "50%", right: "0.75rem", transform: "translateY(-50%)" }}
          >
            <CalendarDays className="h-4 w-4" />
          </span>
        </div>
      </div>
      <button
        className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/15"
        type="submit"
      >
        Check availability
      </button>
    </form>
  );
}
