/**
 * forecast-conferences — read-only feed of upcoming conferences for Forecast.
 *
 * Replaces Forecast's use of Hallway's service-role key. Forecast calls:
 *   GET https://<project>.supabase.co/functions/v1/forecast-conferences
 *   Authorization: Bearer <FORECAST_API_TOKEN>
 *
 * - Token: Supabase function secret FORECAST_API_TOKEN (>= 32 chars), compared
 *   in constant time. If unset, the endpoint is disabled (fails closed).
 * - Returns ONLY upcoming, non-archived conferences plus their speakers.
 *   Leads, contacts, notes, recaps and user data are never read.
 * - verify_jwt = false in config.toml: Forecast authenticates with this token,
 *   not a Supabase user JWT.
 * - Multi-company (future): when organizations land, bind the token to one
 *   org (e.g. FORECAST_ORG_ID) and filter conferences by org_id.
 *
 * Optional query params:
 *   ?include_past_days=N   also include conferences that ended in the last N
 *                          days (0–365, default 0)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Constant-time comparison of two secrets (hash first so lengths match). */
async function tokensMatch(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * conferences.start_date/end_date are TEXT columns. Normalize to YYYY-MM-DD,
 * or null when the value can't be read.
 */
function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) {
      return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }
  const loose = new Date(s);
  if (isNaN(loose.getTime())) return null;
  // Interpret loose formats ("11/5/2026", "Nov 5, 2026") by their local calendar date.
  const y = loose.getFullYear(), mo = loose.getMonth() + 1, d = loose.getDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("FORECAST_API_TOKEN") ?? "";
  if (expected.length < 32) {
    console.error("[forecast-conferences] FORECAST_API_TOKEN not set (or too short); endpoint disabled");
    return json({ error: "Endpoint not configured" }, 503);
  }

  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !(await tokensMatch(provided, expected))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const pastDaysRaw = Number(url.searchParams.get("include_past_days") ?? "0");
  const pastDays = Number.isFinite(pastDaysRaw) ? Math.min(Math.max(Math.trunc(pastDaysRaw), 0), 365) : 0;
  const cutoff = new Date(Date.now() - pastDays * 86_400_000).toISOString().slice(0, 10);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await admin
    .from("conferences")
    .select("id, name, start_date, end_date, location, description, exec_summary, tags, source_url, updated_at")
    .or("archived.is.null,archived.eq.false")
    .order("start_date", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("[forecast-conferences] query failed:", error.message);
    return json({ error: "Query failed" }, 500);
  }

  // Dates are TEXT, so filter "upcoming" after normalizing instead of in SQL.
  const conferences = (rows ?? [])
    .map((c) => {
      const start = normalizeDate(c.start_date);
      const end = normalizeDate(c.end_date) ?? start;
      return { ...c, start_date: start, end_date: end };
    })
    .filter((c) => c.end_date !== null && c.end_date >= cutoff);

  const ids = conferences.map((c) => c.id);
  const speakersByConference = new Map<string, unknown[]>();
  if (ids.length) {
    const { data: speakers, error: speakersError } = await admin
      .from("conference_speakers")
      .select("conference_id, name, title, organization, session_title, session_time, source_url, extracted_at")
      .in("conference_id", ids)
      .order("name", { ascending: true });
    if (speakersError) {
      // Table may not exist yet if the migration hasn't run; still serve conferences.
      console.error("[forecast-conferences] speakers query failed:", speakersError.message);
    }
    for (const s of speakers ?? []) {
      const { conference_id, ...rest } = s;
      const list = speakersByConference.get(conference_id) ?? [];
      list.push(rest);
      speakersByConference.set(conference_id, list);
    }
  }

  return json({
    generated_at: new Date().toISOString(),
    count: conferences.length,
    conferences: conferences.map((c) => ({
      id: c.id,
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      location: c.location ?? null,
      description: c.description ?? null,
      exec_summary: c.exec_summary ?? null,
      tags: c.tags ?? [],
      source_url: c.source_url ?? null,
      updated_at: c.updated_at ?? null,
      speakers: speakersByConference.get(c.id) ?? [],
    })),
  });
});
