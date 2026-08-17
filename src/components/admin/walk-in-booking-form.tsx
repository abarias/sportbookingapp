"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  checkWalkInCustomerAction,
  createWalkInBookingAction,
  type WalkInBookingActionState
} from "@/features/admin/actions";
import { formatCurrency } from "@/lib/formatting/currency";
import { minutesToTimeLabel } from "@/lib/time/slots";
import type { DaySlot } from "@/server/bookings/core";

type FacilityOption = {
  id: string;
  name: string;
  timezone: string;
  priceAmountMinor: number;
  priceBillingMode: "PER_HOUR" | "PER_BLOCK";
  slotIntervalMinutes: number;
  slots: DaySlot[];
};

type WalkInBookingFormProps = {
  facilities: FacilityOption[];
  dateKey: string;
  dateLabel: string;
};

type HourBlock = {
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  reason: "AVAILABLE" | "BOOKED" | "BLOCKED";
};

const initialState: WalkInBookingActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return <Button disabled={pending} type="submit">{pending ? "Checking..." : label}</Button>;
}

function CreateBookingButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit">
      {pending ? "Creating confirmed booking..." : "Create confirmed walk-in booking"}
    </Button>
  );
}

function buildHourBlocks(slots: DaySlot[], slotIntervalMinutes: number) {
  const slotsPerHour = 60 / slotIntervalMinutes;

  if (!Number.isInteger(slotsPerHour) || slotsPerHour < 1) {
    return [];
  }

  return Array.from({ length: Math.floor(slots.length / slotsPerHour) }, (_, index) => {
    const candidateSlots = slots.slice(index * slotsPerHour, (index + 1) * slotsPerHour);
    const firstSlot = candidateSlots[0];
    const lastSlot = candidateSlots[candidateSlots.length - 1];

    if (!firstSlot || !lastSlot) {
      return null;
    }

    const isAvailable = candidateSlots.every((slot) => slot.isAvailable);

    return {
      startMinutes: firstSlot.startMinutes,
      endMinutes: lastSlot.endMinutes,
      isAvailable,
      reason: isAvailable ? "AVAILABLE" : candidateSlots.some((slot) => slot.reason === "BOOKED") ? "BOOKED" : "BLOCKED"
    } satisfies HourBlock;
  }).filter((block): block is HourBlock => block !== null);
}

function formatTimeInput(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const remainingMinutes = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${remainingMinutes}`;
}

function getBookingAmount(facility: FacilityOption, durationMinutes: number) {
  return facility.priceBillingMode === "PER_BLOCK"
    ? facility.priceAmountMinor
    : Math.round((facility.priceAmountMinor * durationMinutes) / 60);
}

function getBlockTone(block: HourBlock, selected: boolean) {
  if (selected) {
    return "border-amber-200 bg-amber-300 text-stone-950";
  }

  if (block.reason === "AVAILABLE") {
    return "border-emerald-300/70 bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30";
  }

  if (block.reason === "BOOKED") {
    return "cursor-not-allowed border-rose-300/50 bg-rose-500/20 text-rose-100 opacity-80";
  }

  return "cursor-not-allowed border-stone-500/50 bg-stone-700/40 text-stone-300 opacity-80";
}

export function WalkInBookingForm({ facilities, dateKey, dateLabel }: WalkInBookingFormProps) {
  const [customerState, checkCustomer] = useActionState(checkWalkInCustomerAction, initialState);
  const [bookingState, createBooking] = useActionState(createWalkInBookingAction, initialState);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilities[0]?.id ?? "");
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");

  const customer = customerState.customer;
  const selectedFacility = facilities.find((facility) => facility.id === selectedFacilityId) ?? facilities[0];
  const hourBlocks = useMemo(
    () => (selectedFacility ? buildHourBlocks(selectedFacility.slots, selectedFacility.slotIntervalMinutes) : []),
    [selectedFacility]
  );
  const selectedBlocks = useMemo(
    () => hourBlocks.filter((block) => selectionStart !== null && selectionEnd !== null && block.startMinutes >= selectionStart && block.endMinutes <= selectionEnd),
    [hourBlocks, selectionEnd, selectionStart]
  );
  const durationMinutes = selectedBlocks.length * 60;
  const amountMinor = selectedFacility ? getBookingAmount(selectedFacility, durationMinutes) : 0;
  const canSubmitBooking = Boolean(customer && selectedFacility && selectedBlocks.length > 0 && selectionStart !== null && paymentMethod && (paymentMethod === "cash" || paymentReference.trim()));

  function selectFacility(facilityId: string) {
    setSelectedFacilityId(facilityId);
    setSelectionStart(null);
    setSelectionEnd(null);
  }

  function selectBlock(block: HourBlock) {
    if (!block.isAvailable) {
      return;
    }

    if (selectionStart === null || selectionEnd === null) {
      setSelectionStart(block.startMinutes);
      setSelectionEnd(block.endMinutes);
      return;
    }

    const isSelected = block.startMinutes >= selectionStart && block.endMinutes <= selectionEnd;

    if (isSelected && selectedBlocks.length === 1) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    if (isSelected && block.startMinutes === selectionStart) {
      setSelectionStart(block.endMinutes);
      return;
    }

    if (isSelected && block.endMinutes === selectionEnd) {
      setSelectionEnd(block.startMinutes);
      return;
    }

    if (isSelected) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    const nextStart = Math.min(selectionStart, block.startMinutes);
    const nextEnd = Math.max(selectionEnd, block.endMinutes);
    const nextBlocks = hourBlocks.filter((candidate) => candidate.startMinutes >= nextStart && candidate.endMinutes <= nextEnd);

    if (nextBlocks.length > 0 && nextBlocks.every((candidate) => candidate.isAvailable)) {
      setSelectionStart(nextStart);
      setSelectionEnd(nextEnd);
      return;
    }

    setSelectionStart(block.startMinutes);
    setSelectionEnd(block.endMinutes);
  }

  if (!customer) {
    return (
      <section className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Step 1</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Identify the customer</h2>
          <p className="mt-2 text-sm leading-6 text-stone-400">
            Name, email, and mobile number are required. Existing customers must book and pay through their own account.
          </p>
        </div>
        <form action={checkCustomer} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-stone-200">
            <span>Customer name</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="fullName" onChange={(event) => setFullName(event.target.value)} required value={fullName} />
            {customerState.fieldErrors?.fullName ? <p className="text-rose-300">{customerState.fieldErrors.fullName}</p> : null}
          </label>
          <label className="space-y-2 text-sm text-stone-200">
            <span>Mobile number</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="phone" onChange={(event) => setPhone(event.target.value)} placeholder="09171234567" required type="tel" value={phone} />
            {customerState.fieldErrors?.phone ? <p className="text-rose-300">{customerState.fieldErrors.phone}</p> : null}
          </label>
          <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
            <span>Email address</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" required type="email" value={email} />
            {customerState.fieldErrors?.email ? <p className="text-rose-300">{customerState.fieldErrors.email}</p> : null}
          </label>
          {customerState.existingCustomer ? (
            <div className="md:col-span-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
              <p>{customerState.message}</p>
              <Button asChild className="mt-3" variant="secondary">
                <Link href={`/login?callbackUrl=/facilities`}>Ask the customer to sign in</Link>
              </Button>
            </div>
          ) : null}
          {customerState.message && !customerState.existingCustomer ? <p className="md:col-span-2 text-sm text-rose-300">{customerState.message}</p> : null}
          {customerState.success ? <p className="md:col-span-2 text-sm text-emerald-300">{customerState.success}</p> : null}
          <div className="md:col-span-2">
            <SubmitButton label="Check customer details" />
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-[1.75rem] border border-amber-300/25 bg-stone-950/70 p-6 shadow-[0_24px_80px_rgba(251,191,36,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Step 2</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Create the walk-in booking</h2>
          <p className="mt-2 text-sm text-stone-400">{customer.fullName} • {customer.email} • {customer.phone}</p>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-100">New customer</span>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-white">Choose a facility</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((facility) => (
            <button
              key={facility.id}
              className={`rounded-2xl border p-4 text-left transition ${facility.id === selectedFacility?.id ? "border-amber-200 bg-amber-300 text-stone-950" : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"}`}
              onClick={() => selectFacility(facility.id)}
              type="button"
            >
              <p className="font-semibold">{facility.name}</p>
              <p className="mt-1 text-sm opacity-75">{formatCurrency(facility.priceAmountMinor, "PHP")} per hour</p>
            </button>
          ))}
        </div>
      </div>

      {selectedFacility ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white">Available hourly slots for {dateLabel}</p>
            <p className="mt-1 text-sm text-stone-400">Click consecutive slots to select more than one hour. This admin booking is confirmed immediately; no payment hold is created.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {hourBlocks.map((block) => {
              const selected = selectedBlocks.some((candidate) => candidate.startMinutes === block.startMinutes);
              const label = block.reason === "AVAILABLE" ? "Available" : block.reason === "BOOKED" ? "Booked" : "Blocked";

              return (
                <button
                  key={block.startMinutes}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${getBlockTone(block, selected)}`}
                  disabled={!block.isAvailable}
                  onClick={() => selectBlock(block)}
                  type="button"
                >
                  <p className="font-semibold">{minutesToTimeLabel(block.startMinutes)} - {minutesToTimeLabel(block.endMinutes)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em]">{selected ? "Selected" : label}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <form
        action={createBooking}
        className="space-y-5 border-t border-white/10 pt-5"
        onSubmit={(event) => {
          if (!canSubmitBooking || !window.confirm(`Create a confirmed walk-in booking for ${dateLabel} for ${formatCurrency(amountMinor, "PHP")}?`)) {
            event.preventDefault();
          }
        }}
      >
        <input name="fullName" type="hidden" value={customer.fullName} />
        <input name="email" type="hidden" value={customer.email} />
        <input name="phone" type="hidden" value={customer.phone} />
        <input name="facilityId" type="hidden" value={selectedFacility?.id ?? ""} />
        <input name="dateKey" type="hidden" value={dateKey} />
        <input name="startTime" type="hidden" value={selectionStart === null ? "" : formatTimeInput(selectionStart)} />
        <input name="durationMinutes" type="hidden" value={durationMinutes || ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-stone-200">
            <span>Payment method</span>
            <select className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="paymentMethod" onChange={(event) => setPaymentMethod(event.target.value)} value={paymentMethod}>
              <option value="cash">Cash</option>
              <option value="manual_gcash">GCash</option>
              <option value="manual_bank_transfer">Bank transfer</option>
            </select>
            {bookingState.fieldErrors?.paymentMethod ? <p className="text-rose-300">{bookingState.fieldErrors.paymentMethod}</p> : null}
          </label>
          <label className="space-y-2 text-sm text-stone-200">
            <span>Transaction reference {paymentMethod === "cash" ? "(optional)" : ""}</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white" name="paymentReference" onChange={(event) => setPaymentReference(event.target.value)} placeholder={paymentMethod === "cash" ? "Optional cash receipt number" : "Enter transfer reference"} value={paymentReference} />
            {bookingState.fieldErrors?.paymentReference ? <p className="text-rose-300">{bookingState.fieldErrors.paymentReference}</p> : null}
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-stone-400">Selected booking</p>
            <p className="mt-1 font-semibold text-white">{selectedBlocks.length > 0 && selectionStart !== null ? `${minutesToTimeLabel(selectionStart)} - ${minutesToTimeLabel(selectionStart + durationMinutes)}` : "Select an available slot"}</p>
          </div>
          <p className="text-lg font-semibold text-white">{formatCurrency(amountMinor, "PHP")}</p>
        </div>

        {bookingState.existingCustomer ? <p className="text-sm text-amber-200">{bookingState.message} <Link className="underline" href="/login?callbackUrl=/facilities">Ask them to sign in.</Link></p> : null}
        {bookingState.message && !bookingState.existingCustomer ? <p className="text-sm text-rose-300">{bookingState.message}</p> : null}
        {bookingState.success ? <p className="text-sm text-emerald-300">{bookingState.success}</p> : null}
        <CreateBookingButton disabled={!canSubmitBooking} />
      </form>
    </section>
  );
}
