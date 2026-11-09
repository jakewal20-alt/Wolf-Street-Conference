/** Time and time-zone helpers for timed calendar events (meetings). */

export const TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (UK)" },
  { value: "Europe/Berlin", label: "Central Europe (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
];

/** The browser's own IANA time zone, e.g. "America/New_York". */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

/** Time-zone options, making sure the given zone (e.g. the user's own) is listed. */
export function timeZoneOptions(include?: string | null) {
  if (!include || TIME_ZONES.some((z) => z.value === include)) return TIME_ZONES;
  return [{ value: include, label: include.replace(/_/g, " ") }, ...TIME_ZONES];
}

function parseHm(time: string | null | undefined): [number, number] | null {
  if (!time) return null;
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return [h, min];
}

function hm12(time: [number, number]): string {
  const [h, m] = time;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Short zone name such as "EST" / "PDT" for a date in that zone. */
export function zoneAbbreviation(timeZone: string, onDate: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(onDate)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * "2:00 PM – 3:00 PM EST", or null for an all-day event / no start time.
 * Times are wall-clock times in the event's own time zone.
 */
export function formatEventTime(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  timeZone?: string | null,
  onDate?: Date,
): string | null {
  const start = parseHm(startTime);
  if (!start) return null;
  const end = parseHm(endTime);
  const range = end ? `${hm12(start)} – ${hm12(end)}` : hm12(start);
  return timeZone ? `${range} ${zoneAbbreviation(timeZone, onDate)}` : range;
}

/** "HH:MM" or null, from an <input type="time"> value. */
export function normalizeTime(value: string): string | null {
  const t = parseHm(value);
  return t ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}` : null;
}
