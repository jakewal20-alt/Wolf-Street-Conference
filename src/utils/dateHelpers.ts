import { startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, addWeeks, subWeeks, format as dateFnsFormat, parseISO } from "date-fns";

/**
 * Get the start of the week (Sunday at 00:00 UTC-8)
 * @param date - The date to get the week start for
 * @returns Date object representing Sunday 00:00 UTC-8
 */
export function getWeekStart(date: Date = new Date()): Date {
  // Start week on Sunday (weekStartsOn: 0)
  return dateStartOfWeek(date, { weekStartsOn: 0 });
}

/**
 * Get the end of the week (Saturday at 23:59:59.999 UTC-8)
 * @param date - The date to get the week end for
 * @returns Date object representing Saturday 23:59:59.999 UTC-8
 */
export function getWeekEnd(date: Date = new Date()): Date {
  // End week on Saturday (weekStartsOn: 0 means Sunday-Saturday)
  return dateEndOfWeek(date, { weekStartsOn: 0 });
}

/**
 * Get the week identifier string (Sunday's date in yyyy-MM-dd format)
 * @param date - The date to get the week identifier for
 * @returns String in format "yyyy-MM-dd" representing the Sunday of that week
 */
export function getWeekIdentifier(date: Date = new Date()): string {
  const weekStart = getWeekStart(date);
  return dateFnsFormat(weekStart, "yyyy-MM-dd");
}

/**
 * Get the current week start
 * @returns Date object representing this week's Sunday
 */
export function getCurrentWeekStart(): Date {
  return getWeekStart(new Date());
}

/**
 * Move to the next week
 * @param currentWeek - Current week start date
 * @returns Date object representing next week's Sunday
 */
export function getNextWeek(currentWeek: Date): Date {
  return addWeeks(currentWeek, 1);
}

/**
 * Move to the previous week
 * @param currentWeek - Current week start date
 * @returns Date object representing previous week's Sunday
 */
export function getPreviousWeek(currentWeek: Date): Date {
  return subWeeks(currentWeek, 1);
}

/**
 * Check if a date falls within a given week
 * @param date - The date to check
 * @param weekStart - The Sunday start of the week
 * @returns boolean indicating if the date is in the week
 */
export function isDateInWeek(date: Date | string, weekStart: Date): boolean {
  const checkDate = typeof date === "string" ? parseISO(date) : date;
  const weekEnd = getWeekEnd(weekStart);
  return checkDate >= weekStart && checkDate <= weekEnd;
}

/**
 * Get a formatted week label (e.g., "Week of Nov 24, 2024")
 * @param weekStart - The Sunday start of the week
 * @returns Formatted string
 */
export function getWeekLabel(weekStart: Date): string {
  return `Week of ${dateFnsFormat(weekStart, "MMM d, yyyy")}`;
}

/**
 * Get the week start for a specific meeting date
 * This ensures that any meeting date is properly assigned to its week
 * @param meetingDate - The date of the meeting
 * @returns Date object representing the Sunday of that week
 */
export function getWeekStartForMeeting(meetingDate: Date | string): Date {
  const date = typeof meetingDate === "string" ? parseISO(meetingDate) : meetingDate;
  return getWeekStart(date);
}

/**
 * Check if a Date object is valid (not Invalid Date)
 */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Parse a date value stored as text, returning null when it can't be read.
 *
 * calendar_events / conferences store dates in TEXT columns, so values can be
 * "2026-11-05", "2026-11-05T14:00:00Z", "2026-11-05 14:00:00+00",
 * "11/5/2026", or junk. Date-only values are read as LOCAL dates (so
 * "2025-02-01" doesn't become Jan 31 west of UTC).
 */
export function tryParseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Date-only: YYYY-MM-DD (optionally followed by nothing else)
  const dateOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly.map(Number);
    const result = new Date(y, m - 1, d);
    return isValidDate(result) && result.getMonth() === m - 1 ? result : null;
  }

  // ISO / Postgres timestamp ("T" or space separator)
  const iso = parseISO(str.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T"));
  if (isValidDate(iso)) return iso;

  // Anything else the browser understands (e.g. "11/5/2026", "Nov 5, 2026")
  const loose = new Date(str);
  return isValidDate(loose) ? loose : null;
}

/**
 * Parse a stored date string as a local date.
 * Always returns a valid Date (falls back to the current date when the value
 * can't be read). Prefer tryParseDate when you need to know it failed.
 */
export function parseDateLocal(dateString: string | null | undefined): Date {
  return tryParseDate(dateString) ?? new Date();
}

/**
 * Safe wrapper around date-fns format() that never throws.
 * Returns fallback string if the date is invalid.
 */
export function safeFormat(date: Date | string | null | undefined, formatStr: string, fallback = "—"): string {
  try {
    if (!date) return fallback;
    const d = typeof date === "string" ? tryParseDate(date) : date;
    if (!d || !isValidDate(d)) return fallback;
    return dateFnsFormat(d, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Safe wrapper around new Date(value) that never returns Invalid Date.
 * Returns current date as fallback.
 */
export function safeDate(value: string | number | Date | null | undefined): Date {
  if (!value) return new Date();
  try {
    const d = value instanceof Date ? value : new Date(value);
    return isValidDate(d) ? d : new Date();
  } catch {
    return new Date();
  }
}
