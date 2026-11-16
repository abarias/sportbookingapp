export type MinuteInterval = {
  startMinutes: number;
  endMinutes: number;
};

export type DaySlot = {
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  reason: "AVAILABLE" | "BOOKED" | "BLOCKED" | "CURRENT";
};

type BuildDaySlotsArgs = {
  openingRange: MinuteInterval;
  slotIntervalMinutes: number;
  busyIntervals: Array<MinuteInterval & { reason: "BOOKED" | "BLOCKED" | "CURRENT" }>;
};

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function rangesOverlapByMinute(a: MinuteInterval, b: MinuteInterval) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function buildDaySlots({ openingRange, slotIntervalMinutes, busyIntervals }: BuildDaySlotsArgs): DaySlot[] {
  const slots: DaySlot[] = [];

  for (
    let startMinutes = openingRange.startMinutes;
    startMinutes + slotIntervalMinutes <= openingRange.endMinutes;
    startMinutes += slotIntervalMinutes
  ) {
    const currentRange = {
      startMinutes,
      endMinutes: startMinutes + slotIntervalMinutes
    };

    const blockingInterval = busyIntervals.find((interval) => rangesOverlapByMinute(currentRange, interval));

    slots.push({
      ...currentRange,
      isAvailable: !blockingInterval,
      reason: blockingInterval?.reason ?? "AVAILABLE"
    });
  }

  return slots;
}

export function canFitDuration(slots: DaySlot[], startMinutes: number, durationMinutes: number, slotIntervalMinutes: number) {
  const stepsRequired = durationMinutes / slotIntervalMinutes;

  if (!Number.isInteger(stepsRequired) || stepsRequired <= 0) {
    return false;
  }

  const startIndex = slots.findIndex((slot) => slot.startMinutes === startMinutes);

  if (startIndex === -1) {
    return false;
  }

  const candidateSlots = slots.slice(startIndex, startIndex + stepsRequired);

  return candidateSlots.length === stepsRequired && candidateSlots.every((slot) => slot.isAvailable);
}
