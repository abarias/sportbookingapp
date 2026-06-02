import { addMonths, endOfMonth, getDay, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getLastMondayOfMonth(date: Date) {
  const monthEnd = endOfMonth(date);
  const day = getDay(monthEnd);
  const daysSinceMonday = (day + 6) % 7;

  return subDays(monthEnd, daysSinceMonday);
}

export function getBookingWindow(timezone: string, now = new Date()) {
  const localTodayKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const localTodayNoon = fromZonedTime(`${localTodayKey}T12:00:00`, timezone);
  const lastMonday = getLastMondayOfMonth(localTodayNoon);
  const maxMonthEnd = endOfMonth(addMonths(localTodayNoon, localTodayNoon >= lastMonday ? 2 : 1));

  return {
    minDateKey: localTodayKey,
    maxDateKey: formatInTimeZone(maxMonthEnd, timezone, "yyyy-MM-dd")
  };
}

export function normalizeDateKeyWithinBookingWindow(value: string | undefined, timezone: string, now = new Date()) {
  const window = getBookingWindow(timezone, now);

  if (!value || !DATE_KEY_PATTERN.test(value)) {
    return window.minDateKey;
  }

  if (value < window.minDateKey) {
    return window.minDateKey;
  }

  if (value > window.maxDateKey) {
    return window.maxDateKey;
  }

  return value;
}

export function isDateWithinBookingWindow(dateKey: string, timezone: string, now = new Date()) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    return false;
  }

  const window = getBookingWindow(timezone, now);
  return dateKey >= window.minDateKey && dateKey <= window.maxDateKey;
}
