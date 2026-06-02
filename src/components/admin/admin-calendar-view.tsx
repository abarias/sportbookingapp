import Link from "next/link";

import { formatDateTimeRange } from "@/lib/time/slots";
import { formatSlotRange, type AdminCalendarMonthDay } from "@/server/admin/calendar";

type DaySchedule = {
  facilityId: string;
  facilityName: string;
  timezone: string;
  slotIntervalMinutes: number;
  isEnabled: boolean;
  openingRange: {
    startMinutes: number;
    endMinutes: number;
  } | null;
  slots: Array<{
    startMinutes: number;
    endMinutes: number;
    isAvailable: boolean;
    reason: "AVAILABLE" | "BOOKED" | "BLOCKED";
  }>;
  bookings: Array<{
    id: string;
    status: string;
    startAtUtc: Date;
    endAtUtc: Date;
    user: {
      fullName: string;
      email: string;
    };
  }>;
  blockedSchedules: Array<{
    id: string;
    title: string;
    reason: string | null;
    startAtUtc: Date;
    endAtUtc: Date;
  }>;
  summary: {
    bookedSlotCount: number;
    blockedSlotCount: number;
    availableSlotCount: number;
    isFullyBooked: boolean;
    isFullyBlocked: boolean;
    hasBookings: boolean;
  };
};

export function AdminCalendarGrid(props: {
  monthKey: string;
  selectedDateKey: string;
  selectedView: "schedule" | "facility";
  days: AdminCalendarMonthDay[];
}) {
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.18em] text-stone-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="px-3 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {props.days.map((day) => {
          const hasBlocked = day.fullyBlockedFacilityNames.length > 0;
          const hasFull = day.fullyBookedFacilityNames.length > 0;
          const hasBookings = day.bookedFacilityNames.length > 0;
          const isSelected = day.dateKey === props.selectedDateKey;

          const tone = hasBlocked
            ? "border-rose-300/60 bg-rose-500/20"
            : hasFull
              ? "border-amber-300/60 bg-amber-500/20"
              : hasBookings
                ? "border-emerald-300/60 bg-emerald-500/20"
                : "border-white/10 bg-stone-950/40";

          return (
            <Link
              key={day.dateKey}
              href={`/admin/calendar?month=${props.monthKey}&date=${day.dateKey}&view=${props.selectedView}`}
              className={`min-h-36 rounded-2xl border p-3 text-sm transition hover:border-white/30 ${tone} ${
                day.isCurrentMonth ? "text-white" : "text-stone-500"
              } ${isSelected ? "ring-2 ring-amber-300/70" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{day.dateKey.slice(-2)}</span>
                {day.bookingCount > 0 ? (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em]">
                    {day.bookingCount} booking{day.bookingCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-xs leading-5">
                {day.bookedFacilityNames.length > 0 ? (
                  <p className="text-emerald-100">Booked: {day.bookedFacilityNames.slice(0, 2).join(", ")}{day.bookedFacilityNames.length > 2 ? ` +${day.bookedFacilityNames.length - 2}` : ""}</p>
                ) : (
                  <p className="text-stone-400">No bookings</p>
                )}
                {day.fullyBookedFacilityNames.length > 0 ? (
                  <p className="text-amber-100">Full: {day.fullyBookedFacilityNames.slice(0, 2).join(", ")}</p>
                ) : null}
                {day.fullyBlockedFacilityNames.length > 0 ? (
                  <p className="text-rose-100">Blocked: {day.fullyBlockedFacilityNames.slice(0, 2).join(", ")}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StatusChip({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${tone}`}>{label}</span>;
}

export function AdminDayDetail(props: {
  monthKey: string;
  dateKey: string;
  view: "schedule" | "facility";
  facilityId?: string;
  daySchedules: DaySchedule[];
}) {
  const facilitiesWithBookings = props.daySchedules.filter((schedule) => schedule.bookings.length > 0);
  const facilityOptions = facilitiesWithBookings.length > 0 ? facilitiesWithBookings : props.daySchedules;
  const selectedFacility = facilityOptions.find((schedule) => schedule.facilityId === props.facilityId) ?? facilityOptions[0] ?? props.daySchedules[0];

  return (
    <section id="day-detail" className="space-y-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Day Drill-down</h2>
          <p className="mt-1 text-sm text-stone-400">
            Review bookings, blocks, and slot availability for {props.dateKey}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/calendar?month=${props.monthKey}&date=${props.dateKey}&view=schedule`}
            scroll={false}
            className={`rounded-full px-4 py-2 text-sm transition ${
              props.view === "schedule" ? "bg-amber-400 text-stone-950" : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Schedule View
          </Link>
          <Link
            href={`/admin/calendar?month=${props.monthKey}&date=${props.dateKey}&view=facility${selectedFacility ? `&facilityId=${selectedFacility.facilityId}` : ""}`}
            scroll={false}
            className={`rounded-full px-4 py-2 text-sm transition ${
              props.view === "facility" ? "bg-amber-400 text-stone-950" : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Facility View
          </Link>
        </div>
      </div>

      {props.view === "schedule" ? (
        <div className="grid gap-4">
          {props.daySchedules.map((schedule) => (
            <article key={schedule.facilityId} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{schedule.facilityName}</h3>
                  <p className="text-sm text-stone-400">
                    {schedule.openingRange
                      ? `${formatSlotRange(schedule.openingRange.startMinutes, schedule.openingRange.endMinutes)} operating window`
                      : "Closed on this date"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip label={`${schedule.summary.bookedSlotCount} booked slots`} tone="bg-emerald-400/25 text-emerald-100" />
                  <StatusChip label={`${schedule.summary.blockedSlotCount} blocked slots`} tone="bg-rose-400/25 text-rose-100" />
                  <StatusChip label={`${schedule.summary.availableSlotCount} open slots`} tone="bg-sky-400/25 text-sky-100" />
                  {schedule.summary.isFullyBooked ? <StatusChip label="Fully booked" tone="bg-amber-400/25 text-amber-100" /> : null}
                  {schedule.summary.isFullyBlocked ? <StatusChip label="Fully blocked" tone="bg-rose-400/25 text-rose-100" /> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Bookings</p>
                  {schedule.bookings.length === 0 ? <p className="text-sm text-stone-400">No bookings for this facility on this date.</p> : null}
                  {schedule.bookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-stone-300">
                      <p className="font-medium text-white">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, schedule.timezone)}</p>
                      <p className="mt-1">{booking.user.fullName} • {booking.user.email}</p>
                      <p className="mt-1 text-stone-400">{booking.status.replaceAll("_", " ")}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Blocked schedules</p>
                  {schedule.blockedSchedules.length === 0 ? <p className="text-sm text-stone-400">No blocked schedules on this date.</p> : null}
                  {schedule.blockedSchedules.map((block) => (
                    <div key={block.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-stone-300">
                      <p className="font-medium text-white">{block.title}</p>
                      <p className="mt-1">{formatDateTimeRange(block.startAtUtc, block.endAtUtc, schedule.timezone)}</p>
                      {block.reason ? <p className="mt-1 text-stone-400">{block.reason}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : selectedFacility ? (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            <p className="text-sm font-medium text-white">Facilities with activity</p>
            <div className="flex flex-col gap-2">
              {facilityOptions.map((facility) => (
                <Link
                  key={facility.facilityId}
                  href={`/admin/calendar?month=${props.monthKey}&date=${props.dateKey}&view=facility&facilityId=${facility.facilityId}`}
                  scroll={false}
                  className={`rounded-2xl px-4 py-3 text-sm transition ${
                    facility.facilityId === selectedFacility.facilityId
                      ? "bg-amber-400 text-stone-950"
                      : "bg-stone-950/40 text-white hover:bg-white/10"
                  }`}
                >
                  <div className="font-medium">{facility.facilityName}</div>
                  <div className={`mt-1 text-xs ${facility.facilityId === selectedFacility.facilityId ? "text-stone-900/80" : "text-stone-400"}`}>
                    {facility.bookings.length} booking{facility.bookings.length === 1 ? "" : "s"}
                  </div>
                </Link>
              ))}
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedFacility.facilityName}</h3>
                  <p className="text-sm text-stone-400">
                    {selectedFacility.openingRange
                      ? `${formatSlotRange(selectedFacility.openingRange.startMinutes, selectedFacility.openingRange.endMinutes)} operating window`
                      : "Closed on this date"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip label={`${selectedFacility.summary.availableSlotCount} available`} tone="bg-sky-400/25 text-sky-100" />
                  <StatusChip label={`${selectedFacility.summary.bookedSlotCount} booked`} tone="bg-emerald-400/25 text-emerald-100" />
                  <StatusChip label={`${selectedFacility.summary.blockedSlotCount} blocked`} tone="bg-rose-400/25 text-rose-100" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
              <div className="mb-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em]">
                <span className="rounded-full bg-sky-400/25 px-3 py-1 text-sky-100">Available</span>
                <span className="rounded-full bg-emerald-400/25 px-3 py-1 text-emerald-100">Booked</span>
                <span className="rounded-full bg-rose-400/25 px-3 py-1 text-rose-100">Blocked</span>
              </div>
              {selectedFacility.slots.length === 0 ? (
                <p className="text-sm text-stone-400">No operating slots on this date.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {selectedFacility.slots.map((slot) => {
                    const tone =
                      slot.reason === "AVAILABLE"
                        ? "border-sky-300/50 bg-sky-500/20 text-sky-100"
                        : slot.reason === "BOOKED"
                          ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
                          : "border-rose-300/50 bg-rose-500/20 text-rose-100";

                    return (
                      <div key={`${slot.startMinutes}-${slot.endMinutes}`} className={`rounded-xl border px-3 py-2 text-sm ${tone}`}>
                        <div className="font-medium">{formatSlotRange(slot.startMinutes, slot.endMinutes)}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em]">{slot.reason}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
                <p className="text-sm font-medium text-white">Bookings</p>
                <div className="mt-3 space-y-3">
                  {selectedFacility.bookings.length === 0 ? <p className="text-sm text-stone-400">No bookings for this facility on this date.</p> : null}
                  {selectedFacility.bookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-stone-300">
                      <p className="font-medium text-white">{formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, selectedFacility.timezone)}</p>
                      <p className="mt-1">{booking.user.fullName} • {booking.user.email}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
                <p className="text-sm font-medium text-white">Blocked schedules</p>
                <div className="mt-3 space-y-3">
                  {selectedFacility.blockedSchedules.length === 0 ? <p className="text-sm text-stone-400">No blocked schedules for this facility on this date.</p> : null}
                  {selectedFacility.blockedSchedules.map((block) => (
                    <div key={block.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-stone-300">
                      <p className="font-medium text-white">{block.title}</p>
                      <p className="mt-1">{formatDateTimeRange(block.startAtUtc, block.endAtUtc, selectedFacility.timezone)}</p>
                      {block.reason ? <p className="mt-1 text-stone-400">{block.reason}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-400">No facilities available for this date.</p>
      )}
    </section>
  );
}
