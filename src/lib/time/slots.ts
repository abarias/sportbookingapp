import { addDays, differenceInMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayDateKey(timezone: string) {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export function isValidDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

export function normalizeDateKey(value: string | undefined, timezone: string) {
  if (!value || !isValidDateKey(value)) {
    return getTodayDateKey(timezone);
  }

  return value;
}

export function minutesToTimeLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function minutesToTimeInputValue(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function buildUtcDateFromLocalMinutes(dateKey: string, totalMinutes: number, timezone: string) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return fromZonedTime(`${dateKey}T${hours}:${minutes}:00`, timezone);
}

export function buildLocalDayUtcRange(dateKey: string, timezone: string) {
  const startUtc = fromZonedTime(`${dateKey}T00:00:00`, timezone);
  const nextDateKey = formatInTimeZone(addDays(startUtc, 2), timezone, "yyyy-MM-dd");
  const endUtc = fromZonedTime(`${nextDateKey}T00:00:00`, timezone);

  return { startUtc, endUtc };
}

export function getDayOfWeek(dateKey: string, timezone: string) {
  const noonUtc = fromZonedTime(`${dateKey}T12:00:00`, timezone);
  const isoValue = Number.parseInt(formatInTimeZone(noonUtc, timezone, "i"), 10);

  return isoValue % 7;
}

export function getLocalMinutesForDate(valueUtc: Date, dateKey: string, timezone: string) {
  const localDate = toZonedTime(valueUtc, timezone);
  const startOfDayUtc = fromZonedTime(`${dateKey}T00:00:00`, timezone);
  const startOfDayLocal = toZonedTime(startOfDayUtc, timezone);

  return differenceInMinutes(localDate, startOfDayLocal);
}

export function formatDateLabel(dateKey: string, timezone: string) {
  const dateUtc = fromZonedTime(`${dateKey}T12:00:00`, timezone);
  return formatInTimeZone(dateUtc, timezone, "EEE, MMM d");
}

export function formatDateTimeRange(startAtUtc: Date, endAtUtc: Date, timezone: string) {
  const datePart = formatInTimeZone(startAtUtc, timezone, "EEE, MMM d");
  const startPart = formatInTimeZone(startAtUtc, timezone, "h:mm a");
  const endPart = formatInTimeZone(endAtUtc, timezone, "h:mm a");

  return `${datePart} • ${startPart} - ${endPart}`;
}
