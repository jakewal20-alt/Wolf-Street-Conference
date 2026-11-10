/**
 * Pull "company + booth" pairs out of an exhibitor directory, as HTML or as
 * text a person copied from the page. Pure functions, no Deno APIs.
 *
 * Handles both layouts directories use:
 *   "Aechelon Technology (Shield AI)   Booth #1301"   (one line)
 *   "Aechelon Technology (Shield AI)" / "Booth #1301" (name line, then booth line)
 */

export type ParsedExhibitor = { name: string; booth: string | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };

/** HTML -> plain text, one block/cell per line. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(br|p|div|li|tr|td|th|h[1-6]|section|article|header|footer|ul|ol|table|tbody|thead|a|span)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const BOOTH = String.raw`(?:booth|stand|table)\s*(?:no\.?|number|#)?\s*:?\s*#?\s*([A-Z]{0,3}-?\d{1,5}[A-Z]?)`;
const SAME_LINE = new RegExp(String.raw`^(.{2,150}?)[\s,·|–-]+${BOOTH}\s*$`, "i");
const BOOTH_ONLY = new RegExp(String.raw`^${BOOTH}\s*$`, "i");
// Directory chrome that sits next to booth numbers but isn't a company.
const NOT_A_NAME = /^(name|booth|exhibitor|exhibitors|exhibitor list|company|organization|featured exhibitors|explore|view|details|more|map|floor plan|sort by.*|search.*|filter.*|\d+|<<<|>>>|next|previous|page \d+)$/i;

function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").replace(/^[\s•·*\-–|]+|[\s•·*\-–|,]+$/g, "").trim();
  if (name.length < 2 || name.length > 150) return null;
  if (NOT_A_NAME.test(name)) return null;
  if (!/[a-z]/i.test(name)) return null;
  return name;
}

/** Every (name, booth) pair found; duplicates of the same name+booth dropped. */
export function parseExhibitors(textOrHtml: string): ParsedExhibitor[] {
  const text = /<[a-z][\s\S]*>/i.test(textOrHtml) ? htmlToText(textOrHtml) : textOrHtml;
  const lines = text.split(/\r?\n|\t{2,}/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  const out: ParsedExhibitor[] = [];
  const seen = new Set<string>();
  const add = (rawName: string, booth: string) => {
    const name = cleanName(rawName);
    if (!name) return;
    const b = booth.toUpperCase().replace(/^-/, "");
    const key = `${name.toLowerCase()}|${b}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, booth: b });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const only = line.match(BOOTH_ONLY);
    if (only) {
      // Name is the nearest earlier line that isn't directory chrome.
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (BOOTH_ONLY.test(lines[j]) || SAME_LINE.test(lines[j])) break;
        if (cleanName(lines[j])) { add(lines[j], only[1]); break; }
      }
      continue;
    }
    const same = line.match(SAME_LINE);
    if (same) add(same[1], same[2]);
  }
  return out;
}
