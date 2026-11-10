/** Name matching for people from different sources (Forecast, speaker lists, leads). */

const HONORIFICS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sir", "hon", "honorable",
  "gen", "ltg", "lt", "mg", "bg", "col", "ltc", "maj", "cpt", "capt", "cdr", "lcdr", "adm", "radm", "vadm",
  "cmdr", "sgt", "msg", "csm", "cmsgt", "smsgt", "ret", "jr", "sr", "ii", "iii", "iv", "phd", "pe", "usa", "usaf", "usn", "usmc",
]);

/** "Col. Shane P. Taylor, Jr." -> ["shane", "taylor"] (first and last real name tokens). */
export function nameKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const tokens = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length > 1 && !HONORIFICS.has(t));
  if (tokens.length < 2) return null;
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

/** Index items by nameKey for quick lookup. */
export function indexByName<T>(items: T[], getName: (item: T) => string | null | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = nameKey(getName(item));
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}
