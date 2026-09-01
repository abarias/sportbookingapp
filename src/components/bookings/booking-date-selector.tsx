"use client";

type BookingDateSelectorProps = {
  dateKey: string;
  minDateKey: string;
  maxDateKey: string;
  replaceCartItemId?: string;
};

export function BookingDateSelector({ dateKey, minDateKey, maxDateKey, replaceCartItemId }: BookingDateSelectorProps) {
  return (
    <form className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      {replaceCartItemId ? <input name="replaceCartItem" type="hidden" value={replaceCartItemId} /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <label className="text-sm font-medium text-stone-200" htmlFor="date">
          Booking date
        </label>
        <input
          className="block box-border h-11 w-full max-w-full min-w-0 appearance-none rounded-2xl border border-white/10 bg-stone-900/80 px-3 text-sm text-white sm:px-4"
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
