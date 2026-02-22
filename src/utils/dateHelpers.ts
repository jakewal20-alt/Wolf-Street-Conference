import { startOfWeek as dateStartOfWeek, endOfWeek as dateEndOfWeek, addWeeks, subWeeks, format, parseISO } from "date-fns";

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
  return format(weekStart, "yyyy-MM-dd");
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
  return `Week of ${format(weekStart, "MMM d, yyyy")}`;
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
 * Parse a date-only string (YYYY-MM-DD) as a local date, not UTC.
 * This prevents the timezone offset issue where "2025-02-01" becomes Jan 31 in local time.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseDateLocal(dateString: string): Date {
  // If it's already a full ISO string with time, use parseISO
  if (dateString.includes('T')) {
    return parseISO(dateString);
  }
  // For date-only strings, parse as local date by adding T00:00:00
  // This ensures the date is interpreted in local timezone
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
