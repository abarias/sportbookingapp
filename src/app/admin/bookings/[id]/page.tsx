import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { AdminNav } from "@/components/admin/admin-nav";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { RescheduleAdjustmentForm } from "@/components/admin/reschedule-adjustment-form";
import { RescheduleConfirmationForm } from "@/components/admin/reschedule-confirmation-form";
import { RescheduleSlotFilters } from "@/components/admin/reschedule-slot-filters";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange, getLocalMinutesForDate, minutesToTimeLabel } from "@/lib/time/slots";
import { getBookingWindow, normalizeDateKeyWithinBookingWindow } from "@/server/bookings/booking-window";
import { getAdminBookingDetailData } from "@/server/admin/queries";
import { canFitDuration } from "@/server/bookings/core";
import { previewBookingReschedule } from "@/server/bookings/rescheduling";
import { getFacilityDayAvailability } from "@/server/bookings/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ facilityId?: string; date?: string; start?: string; rescheduled?: string }>;
};

function safeStartMinutes(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1380 && parsed % 60 === 0 ? parsed : null;
}

type ReplacementHourBlock = {
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  reason: "AVAILABLE" | "BOOKED" | "BLOCKED" | "CURRENT";
};

function buildReplacementHourBlocks(slots: NonNullable<Awaited<ReturnType<typeof getFacilityDayAvailability>>>["slots"], slotIntervalMinutes: number) {
  const slotsPerHour = 60 / slotIntervalMinutes;
  if (!Number.isInteger(slotsPerHour) || slotsPerHour < 1) return [];

  return Array.from({ length: Math.floor(slots.length / slotsPerHour) }, (_, index) => {
    const candidateSlots = slots.slice(index * slotsPerHour, (index + 1) * slotsPerHour);
    const firstSlot = candidateSlots[0];
    const lastSlot = candidateSlots[candidateSlots.length - 1];
    if (!firstSlot || !lastSlot) return null;

    return {
      startMinutes: firstSlot.startMinutes,
      endMinutes: lastSlot.endMinutes,
      isAvailable: candidateSlots.every((slot) => slot.isAvailable),
      reason: candidateSlots.every((slot) => slot.isAvailable)
        ? "AVAILABLE"
        : candidateSlots.some((slot) => slot.reason === "BOOKED")
          ? "BOOKED"
          : "BLOCKED"
    } satisfies ReplacementHourBlock;
  }).filter((block): block is NonNullable<typeof block> => Boolean(block));
}

function replacementSlotTone(block: ReplacementHourBlock, isSelected: boolean) {
  if (isSelected) {
    return "border-amber-200 bg-amber-300 text-stone-950 shadow-[0_0_0_1px_rgba(253,230,138,0.45),0_18px_45px_rgba(251,191,36,0.18)]";
  }
  if (block.reason === "AVAILABLE") {
    return "border-emerald-300/70 bg-emerald-400/20 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-400/30";
  }
  if (block.reason === "CURRENT") {
    return "cursor-not-allowed border-sky-300/60 bg-sky-400/20 text-sky-50 opacity-90";
  }
  return "cursor-not-allowed border-rose-300/50 bg-rose-500/20 text-rose-100 opacity-80";
}

function adjustmentMessage(differenceMinor: number) {
  if (differenceMinor === 0) return "Same base price. The move completes immediately and keeps the booking confirmed.";
  if (differenceMinor < 0) return `${formatCurrency(Math.abs(differenceMinor), "PHP")} potential refund or customer credit. The move completes immediately and creates an unresolved manual adjustment.`;
  return `${formatCurrency(differenceMinor, "PHP")} additional amount due. The replacement slot will be held while the original booking remains valid.`;
}

export default async function AdminBookingDetailPage({ params, searchParams }: Props) {
  const authorization = await requirePermission("bookings.reschedule");
  await requirePermission("payments.view");
  const { id } = await params;
  const query = await searchParams;
  const [booking, facilities] = await Promise.all([
    getAdminBookingDetailData(id),
    prisma.facility.findMany({ where: { isEnabled: true }, orderBy: [{ type: "asc" }, { name: "asc" }], include: { operatingHours: true } })
  ]);
  if (!booking) notFound();

  const hasReschedulePermission = authorization.permissions.has("bookings.reschedule");
  const isPastOrCompleted = booking.startAtUtc <= new Date();
  const canReschedule = hasReschedulePermission && !isPastOrCompleted;
  const canOverride = authorization.permissions.has("bookings.reschedule.override_adjustment");
  const canResolve = authorization.permissions.has("bookings.reschedule.resolve_adjustment");
  const selectedFacility = facilities.find((facility) => facility.id === query.facilityId) ?? facilities.find((facility) => facility.id === booking.facilityId) ?? facilities[0];
  const replacementTimezone = selectedFacility?.timezone ?? booking.timezone;
  const bookingWindow = getBookingWindow(replacementTimezone);
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : formatInTimeZone(booking.startAtUtc, replacementTimezone, "yyyy-MM-dd");
  const selectedDate = normalizeDateKeyWithinBookingWindow(requestedDate, replacementTimezone);
  const selectedStart = safeStartMinutes(query.start);
  const durationMinutes = Math.round((booking.endAtUtc.getTime() - booking.startAtUtc.getTime()) / 60_000);
  const availability = canReschedule && selectedFacility ? await getFacilityDayAvailability(selectedFacility, selectedDate, { excludeBookingId: booking.id }) : null;
  const currentBookingDateKey = formatInTimeZone(booking.startAtUtc, replacementTimezone, "yyyy-MM-dd");
  const currentBookingRange = selectedFacility?.id === booking.facilityId && selectedDate === currentBookingDateKey
    ? {
        startMinutes: getLocalMinutesForDate(booking.startAtUtc, selectedDate, replacementTimezone),
        endMinutes: getLocalMinutesForDate(booking.endAtUtc, selectedDate, replacementTimezone)
      }
    : null;
  const isCurrentBookingSlot = (startMinutes: number, endMinutes: number) => Boolean(
    currentBookingRange && startMinutes < currentBookingRange.endMinutes && endMinutes > currentBookingRange.startMinutes
  );
  const isCurrentBookingSelection = Boolean(
    selectedStart !== null && isCurrentBookingSlot(selectedStart, selectedStart + durationMinutes)
  );
  const availableStarts = availability?.slots.filter((slot) => !isCurrentBookingSlot(slot.startMinutes, slot.endMinutes) && slot.startMinutes % 60 === 0 && canFitDuration(availability.slots, slot.startMinutes, durationMinutes, availability.slotIntervalMinutes)) ?? [];
  const replacementHourBlocks = availability
    ? buildReplacementHourBlocks(availability.slots, availability.slotIntervalMinutes).map((block) =>
        isCurrentBookingSlot(block.startMinutes, block.endMinutes)
          ? { ...block, isAvailable: false, reason: "CURRENT" as const }
          : block
      )
    : [];

  let preview: Awaited<ReturnType<typeof previewBookingReschedule>> | null = null;
  let previewError: string | null = null;
  if (canReschedule && selectedFacility && selectedStart !== null && !isCurrentBookingSelection) {
    try {
      preview = await previewBookingReschedule({ bookingId: booking.id, replacementFacilityId: selectedFacility.id, dateKey: selectedDate, startMinutes: selectedStart });
    } catch (error) {
      previewError = error instanceof Error ? error.message : "The replacement schedule could not be validated.";
    }
  }

  const reference = booking.payment?.providerReference ?? `BOOK-${booking.id.slice(0, 8).toUpperCase()}`;
  const showRescheduledSuccess = query.rescheduled === "1";
  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Booking administration" title={`Booking ${reference}`} description="Review the active reservation, payment, and complete rescheduling history." />
      {showRescheduledSuccess ? <p aria-live="polite" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">Rescheduling changes saved successfully. Review the current schedule and adjustment status below.</p> : null}
      <AdminNav current="calendar" />
      <div className="flex flex-wrap gap-3"><Link className="text-sm text-amber-200 hover:underline" href="/admin/calendar">Back to calendar</Link><Link className="text-sm text-amber-200 hover:underline" href={`/admin/customers?customerId=${booking.user.id}`}>View customer</Link></div>

      <section className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Current active schedule</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{booking.facility.name}</h2>
          <p className="mt-2 text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p>
          <div className="mt-4 grid gap-2 text-sm text-stone-400 sm:grid-cols-2">
            <p>Customer: <span className="text-white">{booking.user.fullName}</span></p>
            <p>Duration: <span className="text-white">{durationMinutes / 60} hour{durationMinutes === 60 ? "" : "s"}</span></p>
            <p>Current base amount: <span className="text-white">{formatCurrency(booking.amountMinor, "PHP")}</span></p>
            <p>Original payment: <span className="text-white">{booking.payment ? formatCurrency(booking.payment.amountMinor, "PHP") : "No payment"}</span></p>
            <p>Payment reference: <span className="text-white">{reference}</span></p>
          </div>
        </div>
        <BookingStatusBadge bookingStatus={booking.status} paymentStatus={booking.payment?.status ?? null} />
      </section>

      {hasReschedulePermission ? (
        <section className="space-y-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-amber-300">Reschedule</p><h2 className="mt-2 text-2xl font-semibold text-white">Choose a replacement slot</h2><p className="mt-2 text-sm text-stone-400">Selecting a slot does not change the booking. Availability and price are checked again only when you explicitly confirm.</p></div>
          {!canReschedule ? <p className="rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-300">Completed or past bookings cannot be rescheduled.</p> : <>
            <RescheduleSlotFilters facilities={facilities} maxDateKey={bookingWindow.maxDateKey} minDateKey={bookingWindow.minDateKey} selectedFacilityId={selectedFacility?.id} selectedDate={selectedDate} />
          {!availability?.openingRange ? <p className="rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-sm text-stone-400">The facility is closed on this date.</p> : (
            <div>
              <p className="mb-3 text-sm font-medium text-white">Select a starting slot for the existing {durationMinutes / 60}-hour duration. The full booking range will be highlighted.</p>
              <div className="mb-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
                <span className="rounded-full bg-emerald-400/25 px-3 py-1 text-emerald-100">Available</span>
                <span className="rounded-full bg-amber-300 px-3 py-1 text-stone-950">Selected</span>
                <span className="rounded-full bg-sky-400/25 px-3 py-1 text-sky-100">Current booking</span>
                <span className="rounded-full bg-rose-400/25 px-3 py-1 text-rose-100">Booked</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" id="replacement-slots">
                {replacementHourBlocks.map((slot) => {
                  const canSelect = slot.isAvailable && availableStarts.some((available) => available.startMinutes === slot.startMinutes);
                  const isCurrentBooking = slot.reason === "CURRENT";
                  const isSelected = !isCurrentBooking && selectedStart !== null && slot.startMinutes >= selectedStart && slot.startMinutes < selectedStart + durationMinutes;
                  const isSelectedStart = selectedStart === slot.startMinutes;
                  const tone = replacementSlotTone(slot, isSelected);
                  const label = slot.reason === "CURRENT" ? "Current booking" : slot.reason === "AVAILABLE" ? (canSelect ? "Available" : "Unavailable for duration") : "Booked";
                  const content = <><p className="text-base font-semibold">{minutesToTimeLabel(slot.startMinutes)} - {minutesToTimeLabel(slot.endMinutes)}</p><p className="mt-2 text-xs uppercase tracking-[0.16em]">{isSelected ? (isSelectedStart ? "Selected start" : "Included") : label}</p></>;
                  return canSelect ? <Link key={slot.startMinutes} href={`/admin/bookings/${booking.id}?facilityId=${selectedFacility?.id}&date=${selectedDate}&start=${slot.startMinutes}#replacement-slots`} scroll={false} className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${tone}`}>{content}</Link> : <div key={slot.startMinutes} aria-disabled="true" className={`rounded-2xl border px-4 py-4 text-left text-sm ${tone}`}>{content}</div>;
                })}
                {replacementHourBlocks.length === 0 ? <p className="text-sm text-stone-400">No hourly slots are available for this date.</p> : null}
              </div>
            </div>
          )}
          {previewError ? <p className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">{previewError}</p> : null}
          {preview ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-stone-950/50 p-5"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Current booking</p><h3 className="mt-2 font-semibold text-white">{booking.facility.name}</h3><p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}</p><p className="mt-3 text-sm text-stone-400">Original paid base amount</p><p className="text-xl font-semibold text-white">{formatCurrency(preview.originalAmountMinor, "PHP")}</p><p className="mt-2 text-sm text-stone-400">Payment remains {booking.payment?.status.replaceAll("_", " ")}.</p></article>
                <article className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5"><p className="text-xs uppercase tracking-[0.16em] text-amber-300">Replacement booking</p><h3 className="mt-2 font-semibold text-white">{preview.replacement.facility.name}</h3><p className="mt-2 text-sm text-stone-300">{formatDateTimeRange(preview.replacement.startAtUtc, preview.replacement.endAtUtc, preview.replacement.facility.timezone)}</p><p className="mt-3 text-sm text-stone-400">New VAT-exclusive base amount</p><p className="text-xl font-semibold text-white">{formatCurrency(preview.replacementAmountMinor, "PHP")}</p><p className="mt-2 text-sm text-amber-100">{adjustmentMessage(preview.priceDifferenceMinor)}</p></article>
              </div>
              <RescheduleConfirmationForm bookingId={booking.id} replacementFacilityId={preview.replacement.facility.id} dateKey={selectedDate} startMinutes={selectedStart!} differenceMinor={preview.priceDifferenceMinor} canOverrideAdjustment={canOverride} />
            </div>
          ) : null}
          </>}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-6"><h2 className="text-xl font-semibold text-white">Rescheduling history</h2><p className="mt-1 text-sm text-stone-400">Newest activity appears first. Historical schedules and snapshots are immutable.</p></div>
        {booking.reschedules.length ? <div className="divide-y divide-white/10">{booking.reschedules.map((item) => (
          <article key={item.id} className="p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold text-white">{item.originalFacility.name} → {item.replacementFacility.name}</p><p className="mt-1 text-sm text-stone-400">{formatDateTimeRange(item.originalStartAtUtc, item.originalEndAtUtc, item.originalTimezone)} → {formatDateTimeRange(item.replacementStartAtUtc, item.replacementEndAtUtc, item.replacementTimezone)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white">{item.status.replaceAll("_", " ")}</span></div>
            <div className="mt-4 grid gap-2 text-sm text-stone-300 md:grid-cols-3"><p>Original: {formatCurrency(item.originalAmountMinor, "PHP")}</p><p>Replacement: {formatCurrency(item.replacementAmountMinor, "PHP")}</p><p>Difference: {item.priceDifferenceMinor >= 0 ? "+" : "-"}{formatCurrency(Math.abs(item.priceDifferenceMinor), "PHP")}</p><p>Adjustment: {item.adjustmentStatus.replaceAll("_", " ")}</p><p>Initiated by: {item.initiatedBy.fullName}</p><p>Created: {formatInTimeZone(item.createdAt, "Asia/Manila", "MMM d, yyyy h:mm a")}</p></div>
            <p className="mt-3 text-sm text-stone-300"><span className="text-stone-500">Reason:</span> {item.reason}</p>{item.internalNote ? <p className="mt-1 text-sm text-stone-400"><span className="text-stone-500">Internal note:</span> {item.internalNote}</p> : null}{item.customerNote ? <p className="mt-1 text-sm text-stone-400"><span className="text-stone-500">Customer note:</span> {item.customerNote}</p> : null}
            {item.additionalPayment && authorization.permissions.has("payments.view") ? <Link className="mt-3 inline-flex text-sm text-amber-200 hover:underline" href={`/admin/reschedule-payments/${item.additionalPayment.id}`}>View additional payment ({item.additionalPayment.status.replaceAll("_", " ")})</Link> : null}
            {item.adjustmentStatus === "UNRESOLVED" && canResolve ? <RescheduleAdjustmentForm rescheduleId={item.id} maximumAmount={(Math.abs(item.priceDifferenceMinor) / 100).toFixed(2)} /> : null}
            {item.resolutionMethod ? <p className="mt-3 rounded-xl bg-emerald-300/10 p-3 text-sm text-emerald-100">Resolved as {item.resolutionMethod.replaceAll("_", " ")} for {formatCurrency(item.resolutionAmountMinor ?? 0, "PHP")} by {item.resolvedBy?.fullName ?? "staff"}. {item.resolutionNote}</p> : null}
          </article>
        ))}</div> : <p className="p-6 text-sm text-stone-400">No rescheduling history.</p>}
      </section>
    </main>
  );
}
