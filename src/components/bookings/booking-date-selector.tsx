"use client";

type BookingDateSelectorProps = {
  dateKey: string;
  minDateKey: string;
  maxDateKey: string;
};

export function BookingDateSelector({ dateKey, minDateKey, maxDateKey }: BookingDateSelectorProps) {
  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <label className="text-sm font-medium text-stone-200" htmlFor="date">
          Booking date
        </label>
        <input
          className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white"
          defaultValue={dateKey}
          id="date"
          max={maxDateKey}
          min={minDateKey}
          name="date"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          required
          type="date"
        />
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
