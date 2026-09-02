"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { addToCartAction, type CartActionState } from "@/features/cart/actions";
import { createBookingAction, type BookingActionState } from "@/features/bookings/actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatting/currency";
import { createIdempotencyKey } from "@/lib/idempotency";
import { minutesToTimeLabel } from "@/lib/time/slots";
import type { DaySlot } from "@/server/bookings/core";
import type { PriceCalculation, PriceSegment } from "@/server/pricing/types";

type BookingPanelProps = {
  facilityId: string;
  facilitySlug: string;
  dateLabel: string;
  dateKey: string;
  slotIntervalMinutes: number;
  slots: DaySlot[];
  isAuthenticated: boolean;
  priceQuotes: PriceCalculation[];
  replaceCartItemId?: string;
  initialStartMinutes?: number;
  initialDurationMinutes?: number;
};

type HourBlock = {
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  reason: "AVAILABLE" | "BOOKED" | "BLOCKED";
};

const initialState: CartActionState = {};
const CUSTOMER_BOOKING_INCREMENT_MINUTES = 60;

function SubmitButton({ disabled, replacing }: { disabled: boolean; replacing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={disabled || pending} type="submit">
      {pending ? "Saving schedule..." : replacing ? "Update cart item" : "Add to cart"}
    </Button>
  );
}

function BookNowButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={disabled || pending} type="submit">
      {pending ? "Preparing booking..." : "Book now"}
    </Button>
  );
}

function buildHourBlocks(slots: DaySlot[], slotIntervalMinutes: number) {
  const slotsPerHour = CUSTOMER_BOOKING_INCREMENT_MINUTES / slotIntervalMinutes;

  if (!Number.isInteger(slotsPerHour) || slotsPerHour < 1) {
    return [];
  }

  const blocks: HourBlock[] = [];

  for (let index = 0; index + slotsPerHour <= slots.length; index += slotsPerHour) {
    const candidateSlots = slots.slice(index, index + slotsPerHour);
    const firstSlot = candidateSlots[0];
    const lastSlot = candidateSlots[candidateSlots.length - 1];

    if (!firstSlot || !lastSlot) {
      continue;
    }

    const isAvailable = candidateSlots.every((slot) => slot.isAvailable);
    const reason = isAvailable ? "AVAILABLE" : candidateSlots.some((slot) => slot.reason === "BOOKED") ? "BOOKED" : "BLOCKED";

    blocks.push({
      startMinutes: firstSlot.startMinutes,
      endMinutes: lastSlot.endMinutes,
      isAvailable,
      reason
    });
  }

  return blocks;
}

function areContiguousAvailableBlocks(blocks: HourBlock[]) {
  return blocks.every((block, index) => {
    const previous = blocks[index - 1];
    return block.isAvailable && (!previous || previous.endMinutes === block.startMinutes);
  });
}

function getSelectionBlocks(blocks: HourBlock[], startMinutes: number | null, endMinutes: number | null) {
  if (startMinutes === null || endMinutes === null) {
    return [];
  }

  return blocks.filter((block) => block.startMinutes >= startMinutes && block.endMinutes <= endMinutes);
}

function mergePriceSegments(segments: PriceSegment[]) {
  return segments.reduce<PriceSegment[]>((result, segment) => {
    const previous = result[result.length - 1];
    if (previous && previous.ruleId === segment.ruleId && previous.endMinutes === segment.startMinutes) {
      previous.endMinutes = segment.endMinutes;
      previous.durationMinutes += segment.durationMinutes;
      previous.amountMinor = Math.round((previous.rateAmountMinor * previous.durationMinutes) / previous.rateUnitMinutes);
    } else {
      result.push({ ...segment });
    }
    return result;
  }, []);
}

function getSlotTone(block: HourBlock, isSelected: boolean) {
  if (isSelected) {
    return "border-amber-200 bg-amber-300 text-stone-950 shadow-[0_0_0_1px_rgba(253,230,138,0.45),0_18px_45px_rgba(251,191,36,0.18)]";
  }

  if (block.reason === "AVAILABLE") {
    return "border-emerald-300/70 bg-emerald-400/20 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-400/30";
  }

  if (block.reason === "BOOKED") {
    return "cursor-not-allowed border-rose-300/50 bg-rose-500/20 text-rose-100 opacity-80";
  }

  return "cursor-not-allowed border-rose-300/50 bg-rose-500/20 text-rose-100 opacity-80";
}

export function BookingPanel({
  facilityId,
  facilitySlug,
  dateLabel,
  dateKey,
  slotIntervalMinutes,
  slots,
  isAuthenticated,
  priceQuotes,
  replaceCartItemId,
  initialStartMinutes,
  initialDurationMinutes
}: BookingPanelProps) {
  const [selectionStart, setSelectionStart] = useState<number | null>(initialStartMinutes ?? null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(initialStartMinutes !== undefined && initialDurationMinutes !== undefined ? initialStartMinutes + initialDurationMinutes : null);
  const [state, action] = useActionState(addToCartAction, initialState);
  const [bookingState, bookingAction] = useActionState<BookingActionState, FormData>(createBookingAction, {});
  const [idempotencyKey] = useState(createIdempotencyKey);

  const hourBlocks = useMemo(() => buildHourBlocks(slots, slotIntervalMinutes), [slotIntervalMinutes, slots]);
  const selectedBlocks = useMemo(
    () => getSelectionBlocks(hourBlocks, selectionStart, selectionEnd),
    [hourBlocks, selectionEnd, selectionStart]
  );
  const availableHourCount = hourBlocks.filter((block) => block.isAvailable).length;
  const durationMinutes = selectedBlocks.length * CUSTOMER_BOOKING_INCREMENT_MINUTES;
  const selectedQuotes = selectedBlocks.map((block) => priceQuotes.find((quote) => quote.segments[0]?.startMinutes === block.startMinutes)).filter((quote): quote is PriceCalculation => Boolean(quote));
  const priceSegments = mergePriceSegments(selectedQuotes.flatMap((quote) => quote.segments));
  const amountMinor = selectedQuotes.reduce((sum, quote) => sum + quote.amountMinor, 0);
  const isSelectionValid = selectedBlocks.length > 0 && selectedQuotes.length === selectedBlocks.length && areContiguousAvailableBlocks(selectedBlocks);
  const confirmationMessage =
    isSelectionValid && selectionStart !== null && selectionEnd !== null
      ? `Add ${minutesToTimeLabel(selectionStart)} - ${minutesToTimeLabel(selectionEnd)} on ${dateLabel} to your cart for a current VAT-exclusive base price of ${formatCurrency(amountMinor, "PHP")}?`
      : "Add this selected schedule to your cart?";

  function selectBlock(block: HourBlock) {
    if (!block.isAvailable) {
      return;
    }

    if (selectionStart === null || selectionEnd === null) {
      setSelectionStart(block.startMinutes);
      setSelectionEnd(block.endMinutes);
      return;
    }

    const isBlockSelected = block.startMinutes >= selectionStart && block.endMinutes <= selectionEnd;

    if (isBlockSelected && selectedBlocks.length === 1) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    if (isBlockSelected && block.startMinutes === selectionStart) {
      setSelectionStart(block.endMinutes);
      return;
    }

    if (isBlockSelected && block.endMinutes === selectionEnd) {
      setSelectionEnd(block.startMinutes);
      return;
    }

    if (isBlockSelected) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    const nextStart = Math.min(selectionStart, block.startMinutes);
    const nextEnd = Math.max(selectionEnd, block.endMinutes);
    const nextBlocks = getSelectionBlocks(hourBlocks, nextStart, nextEnd);

    if (areContiguousAvailableBlocks(nextBlocks)) {
      setSelectionStart(nextStart);
      setSelectionEnd(nextEnd);
      return;
    }

    setSelectionStart(block.startMinutes);
    setSelectionEnd(block.endMinutes);
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-6 shadow-[0_24px_80px_rgba(251,191,36,0.08)]">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-200">Choose your time</p>
        <p className="text-sm text-stone-200">Sign in to select available hourly slots and reserve this facility.</p>
        <Button asChild className="w-full">
          <Link href={`/login?callbackUrl=/facilities/${facilitySlug}`}>Sign in to book</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-stone-950/70 shadow-[0_24px_90px_rgba(251,191,36,0.10)]">
      <div className="border-b border-white/10 bg-amber-300/10 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-amber-200">Book this facility</p>
            <h2 className="mt-2 font-serif text-3xl text-white">Choose hourly slots</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
              Select one or more consecutive available hourly slots for {dateLabel}. Adding a schedule to your cart does not reserve it; availability is confirmed at checkout.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Open inventory</p>
            <p className="mt-1 text-lg font-semibold text-white">{availableHourCount} hourly slots</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
          <span className="rounded-full bg-emerald-400/25 px-3 py-1 text-emerald-100">Available</span>
          <span className="rounded-full bg-amber-300 px-3 py-1 text-stone-950">Selected</span>
          <span className="rounded-full bg-rose-400/25 px-3 py-1 text-rose-100">Booked</span>
        </div>

        {hourBlocks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-stone-300">
            No hourly slots are available for this date because the facility is closed.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {hourBlocks.map((block) => {
              const isSelected = selectedBlocks.some((selected) => selected.startMinutes === block.startMinutes);
              const quote = priceQuotes.find((item) => item.segments[0]?.startMinutes === block.startMinutes);
              const isBookable = block.isAvailable && Boolean(quote);
              const displayBlock = isBookable ? block : block.isAvailable ? { ...block, isAvailable: false, reason: "BLOCKED" as const } : block;
              const label = block.isAvailable && !quote ? "Pricing unavailable" : block.reason === "AVAILABLE" ? "Available" : "Booked";

              return (
                <button
                  key={block.startMinutes}
                  aria-pressed={isSelected}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${getSlotTone(displayBlock, isSelected)}`}
                  disabled={!isBookable}
                  onClick={() => selectBlock(block)}
                  type="button"
                >
                  <p className="text-base font-semibold">
                    {minutesToTimeLabel(block.startMinutes)} - {minutesToTimeLabel(block.endMinutes)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em]">{isSelected ? "Selected" : label}</p>
                  {block.isAvailable && quote ? <p className="mt-2 text-sm font-medium">Base {formatCurrency(quote.amountMinor, "PHP")}{quote.isHoliday ? ` · ${quote.holidayName ?? "Holiday"}` : ""}</p> : null}
                </button>
              );
            })}
          </div>
        )}

        {state.fieldErrors?.startMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.startMinutes}</p> : null}
        {state.fieldErrors?.durationMinutes ? <p className="text-sm text-rose-300">{state.fieldErrors.durationMinutes}</p> : null}
        {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
        {bookingState.fieldErrors?.startMinutes ? <p className="text-sm text-rose-300">{bookingState.fieldErrors.startMinutes}</p> : null}
        {bookingState.fieldErrors?.durationMinutes ? <p className="text-sm text-rose-300">{bookingState.fieldErrors.durationMinutes}</p> : null}
        {bookingState.error ? <p className="text-sm text-rose-300">{bookingState.error}</p> : null}
      </div>

      <div className="sticky bottom-0 border-t border-white/10 bg-stone-950/95 p-5 backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Selection</p>
            {isSelectionValid && selectionStart !== null && selectionEnd !== null ? (
              <div className="mt-1 space-y-1">
                <p className="text-lg font-semibold text-white">
                  {minutesToTimeLabel(selectionStart)} - {minutesToTimeLabel(selectionEnd)}
                </p>
                <p className="text-sm text-stone-300">
                  {durationMinutes / 60} hour{durationMinutes === 60 ? "" : "s"} • VAT-exclusive base price {formatCurrency(amountMinor, "PHP")}
                </p>
                {priceSegments.length > 1 ? <div className="pt-2 text-xs leading-5 text-stone-400">{priceSegments.map((segment) => <p key={`${segment.startMinutes}-${segment.ruleId}`}>{minutesToTimeLabel(segment.startMinutes)}-{minutesToTimeLabel(segment.endMinutes)} · {segment.rateLabel} · {formatCurrency(segment.amountMinor, "PHP")}</p>)}</div> : null}
                <button
                  className="text-sm font-medium text-amber-200 underline-offset-4 hover:underline"
                  onClick={() => {
                    setSelectionStart(null);
                    setSelectionEnd(null);
                  }}
                  type="button"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-stone-300">Select at least one available hourly slot.</p>
            )}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <form
              action={bookingAction}
              onSubmit={(event) => {
                if (!window.confirm(`Book ${minutesToTimeLabel(selectionStart ?? 0)} - ${minutesToTimeLabel(selectionEnd ?? 0)} on ${dateLabel} now? This will start the payment hold.`)) {
                  event.preventDefault();
                }
              }}
            >
              <input name="facilityId" type="hidden" value={facilityId} />
              <input name="facilitySlug" type="hidden" value={facilitySlug} />
              <input name="dateKey" type="hidden" value={dateKey} />
              <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
              <input name="startMinutes" type="hidden" value={selectionStart ?? ""} />
              <input name="durationMinutes" type="hidden" value={durationMinutes || ""} />
              <BookNowButton disabled={!isSelectionValid} />
            </form>
            <form
              action={action}
              onSubmit={(event) => {
                if (!window.confirm(confirmationMessage)) {
                  event.preventDefault();
                }
              }}
            >
              <input name="facilityId" type="hidden" value={facilityId} />
              <input name="facilitySlug" type="hidden" value={facilitySlug} />
              <input name="dateKey" type="hidden" value={dateKey} />
              <input name="startMinutes" type="hidden" value={selectionStart ?? ""} />
              <input name="durationMinutes" type="hidden" value={durationMinutes || ""} />
              <input name="replaceCartItemId" type="hidden" value={replaceCartItemId ?? ""} />
              <SubmitButton disabled={!isSelectionValid} replacing={Boolean(replaceCartItemId)} />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
