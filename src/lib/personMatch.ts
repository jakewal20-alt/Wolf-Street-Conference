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

const ORG_NOISE = /\b(inc|incorporated|llc|l\.l\.c|corp|corporation|company|co|the|ltd|limited|plc|gmbh|group|holdings|usa|us|na)\b/g;

function orgKey(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(ORG_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keys an organization is known by: "Aechelon Technology (Shield AI)" ->
 * ["aechelon technology", "shield ai"]; "ARA - Applied Research Associates
 * Inc." -> ["ara applied research associates", "ara", "applied research associates"].
 */
export function orgKeys(name: string | null | undefined): string[] {
  if (!name) return [];
  const keys = new Set<string>();
  const add = (s: string) => {
    const k = orgKey(s);
    if (k.length >= 2) keys.add(k);
  };
  add(name.replace(/\(.*?\)/g, " "));
  for (const m of name.matchAll(/\(([^)]+)\)/g)) add(m[1]);
  const parts = name.replace(/\(.*?\)/g, " ").split(/\s+[-–—|/]\s+/);
  if (parts.length > 1) parts.forEach(add);
  return [...keys];
}

// One-word names too common to match inside a longer name on their own.
const GENERIC_ORG_WORDS = new Set([
  "american", "national", "federal", "global", "international", "united", "general", "advanced", "applied",
  "systems", "technologies", "technology", "solutions", "services", "defense", "security", "government",
  "military", "training", "simulation", "aerospace", "engineering", "consulting", "research", "associates",
]);

/** True when one key is the other, or contains it as whole words (and isn't too generic). */
export function keysMatch(a: string, b: string): boolean {
  if (a === b) return a.length >= 3;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.split(" ").length < 2 && (short.length < 6 || GENERIC_ORG_WORDS.has(short))) return false;
  return ` ${long} `.includes(` ${short} `);
}

/** Do these two organization names refer to the same company? */
export function sameOrg(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = orgKeys(a);
  const kb = orgKeys(b);
  return ka.some((x) => kb.some((y) => keysMatch(x, y)));
}
