import { addDays, format } from "date-fns";
import { tryParseDate } from "@/utils/dateHelpers";

export interface IcsEventInput {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean | null;
  /** IANA zone the start/end times are in; without it they are the viewer's local time. */
  time_zone?: string | null;
}

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
function escapeText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + chBytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function parseTime(time: string | null | undefined): [number, number] | null {
  if (!time) return null;
  const [h, m = 0] = time.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
}

const utcStamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/**
 * Build a valid .ics file. All-day / date-only events use VALUE=DATE with an
 * exclusive DTEND (the day after the last day); timed events are written in
 * UTC from the user's local time. Events with unreadable dates are skipped.
 */
export function buildIcs(events: IcsEventInput[], now: Date = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wolf Street//Hallway//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const startDay = tryParseDate(event.start_date);
    if (!startDay) continue;
    const endDay = tryParseDate(event.end_date) ?? startDay;
    const startTime = parseTime(event.start_time);
    const timed = !event.all_day && startTime !== null;

    lines.push("BEGIN:VEVENT");
    // UID domain must stay stable so re-imports update instead of duplicating.
    lines.push(`UID:${event.id}@bacnswolfstreet.com`);
    lines.push(`DTSTAMP:${utcStamp(now)}`);

    if (timed) {
      const start = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), startTime[0], startTime[1]);
      const endTime = parseTime(event.end_time);
      const end = endTime
        ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), endTime[0], endTime[1])
        : new Date(start.getTime() + 60 * 60 * 1000);
      const finalEnd = end > start ? end : new Date(start.getTime() + 60 * 60 * 1000);
      if (event.time_zone) {
        // Wall-clock times in the meeting's own zone; calendar apps convert.
        lines.push(`DTSTART;TZID=${event.time_zone}:${format(start, "yyyyMMdd'T'HHmmss")}`);
        lines.push(`DTEND;TZID=${event.time_zone}:${format(finalEnd, "yyyyMMdd'T'HHmmss")}`);
      } else {
        lines.push(`DTSTART:${utcStamp(start)}`);
        lines.push(`DTEND:${utcStamp(finalEnd)}`);
      }
    } else {
      const lastDay = endDay >= startDay ? endDay : startDay;
      lines.push(`DTSTART;VALUE=DATE:${format(startDay, "yyyyMMdd")}`);
      lines.push(`DTEND;VALUE=DATE:${format(addDays(lastDay, 1), "yyyyMMdd")}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
