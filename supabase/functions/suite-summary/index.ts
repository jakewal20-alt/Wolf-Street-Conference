/**
 * suite-summary — Hallway's tile on the Wolf Street home page
 * (contract: home-summary-contract.md, v1).
 *
 * GET, with the signed-in user's Wolf Street (Supabase) access token.
 * Every query runs as that user (anon key + user JWT), so row-level security
 * applies: the summary never shows more than Hallway itself would.
 *
 * Optional ?tz=<IANA zone> (e.g. America/New_York) sets what "today" means;
 * default UTC.
 *
 * - 401 { code: "signed_out" }  missing/invalid token
 * - 403 { code: "not_member" }  valid account, not approved for Hallway
 * - CORS: only origins in WOLFSTREET_HOME_ORIGIN (comma-separated; default
 *   https://wolfstreet-production.up.railway.app). OPTIONS needs no token.
 * - verify_jwt = false in config.toml so this function, not the gateway,
 *   answers 401 with CORS headers and the contract's body.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays, daysBetween, normalizeDate, todayIn } from "../_shared/dates.ts";

const APP_URL = "https://bacnswolfstreet.com";
const DEFAULT_HOME_ORIGIN = "https://wolfstreet-production.up.railway.app";

function allowedOrigins(): Set<string> {
  const raw = Deno.env.get("WOLFSTREET_HOME_ORIGIN") || DEFAULT_HOME_ORIGIN;
  return new Set(raw.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, apikey, x-client-info, content-type",
    "Vary": "Origin",
  };
  if (allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type Stat = { label: string; value: number; url?: string; hint?: string };
type Item = { kind: "conference" | "meeting" | "followup"; title: string; due?: string; url: string; detail?: string };
type NotCovered = { what: string; why: string };

/** Conference/travel entries on the calendar aren't "meetings". */
function isMeeting(e: { event_type?: string | null; type?: string | null }): boolean {
  const t = `${e.type ?? ""} ${e.event_type ?? ""}`.toLowerCase();
  return !/conference|travel/.test(t);
}

async function summarize(db: SupabaseClient, today: string) {
  const weekEnd = addDays(today, 6);
  const weekStart = addDays(today, -6);
  // Contract order: meetings, follow-ups, touches, leads. A stat we couldn't
  // read is left out (never sent as 0) and explained in notCovered.
  let meetingsStat: Stat | undefined;
  let followupsStat: Stat | undefined;
  let touchesStat: Stat | undefined;
  let leadsStat: Stat | undefined;
  const items: Item[] = [];
  const notCovered: NotCovered[] = [];
  let headline: string | undefined;

  // --- Next conference + leads at it ---------------------------------
  const conf = await db
    .from("conferences")
    .select("id, name, start_date, end_date, location")
    .eq("archived", false)
    .limit(500);
  if (conf.error) {
    notCovered.push({ what: "Conferences", why: "Couldn't read conferences" });
  } else {
    const upcoming = (conf.data ?? [])
      .map((c) => {
        const start = normalizeDate(c.start_date);
        const end = normalizeDate(c.end_date) ?? start;
        return { ...c, start, end };
      })
      .filter((c) => c.start && c.end && c.end >= today)
      .sort((a, b) => a.start!.localeCompare(b.start!));
    const next = upcoming[0];
    if (next) {
      const days = daysBetween(today, next.start!);
      headline = days > 1 ? `${next.name} in ${days} days`
        : days === 1 ? `${next.name} starts tomorrow`
        : days === 0 ? `${next.name} starts today`
        : `${next.name} is on now`;
      items.push({
        kind: "conference",
        title: next.name,
        due: next.start!,
        url: `${APP_URL}/conferences`,
        detail: [next.location, next.end !== next.start ? `${next.start} to ${next.end}` : next.start].filter(Boolean).join(" · "),
      });
      const leads = await db
        .from("conference_leads")
        .select("id", { count: "exact", head: true })
        .eq("conference_id", next.id);
      if (leads.error) notCovered.push({ what: "Leads", why: "Couldn't count leads for the next conference" });
      else leadsStat = ({ label: "Leads at next conference", value: leads.count ?? 0, url: `${APP_URL}/conferences`, hint: next.name });
    } else {
      headline = "No upcoming conferences";
    }
  }

  // --- Meetings in the next 7 days ------------------------------------
  // Dates are TEXT; fetch a bounded window and normalize in code.
  const ev = await db
    .from("calendar_events")
    .select("id, title, start_date, start_time, location, event_type, type")
    .gte("start_date", addDays(today, -1))
    .order("start_date", { ascending: true })
    .limit(500);
  if (ev.error) {
    notCovered.push({ what: "Meetings", why: "Couldn't read the calendar" });
  } else {
    const meetings = (ev.data ?? [])
      .map((e) => ({ ...e, day: normalizeDate(e.start_date) }))
      .filter((e) => e.day && e.day >= today && e.day <= weekEnd && isMeeting(e))
      .sort((a, b) => (a.day! + (a.start_time ?? "")).localeCompare(b.day! + (b.start_time ?? "")));
    meetingsStat = ({ label: "Meetings this week", value: meetings.length, url: `${APP_URL}/calendar`, hint: "next 7 days" });
    for (const m of meetings.slice(0, 5)) {
      items.push({
        kind: "meeting",
        title: m.title,
        due: m.day!,
        url: `${APP_URL}/calendar`,
        detail: [m.start_time?.slice(0, 5), m.location].filter(Boolean).join(" · ") || undefined,
      });
    }
  }

  // --- Follow-ups due (next 7 days, including overdue) ---------------
  const [fc, fl] = await Promise.all([
    db.from("contacts")
      .select("id, name, org_name, next_follow_up_date, next_follow_up_note")
      .not("next_follow_up_date", "is", null)
      .lte("next_follow_up_date", weekEnd)
      .order("next_follow_up_date", { ascending: true })
      .limit(50),
    db.from("conference_leads")
      .select("id, contact_name, company, conference_id, next_follow_up_date, next_follow_up_note")
      .not("next_follow_up_date", "is", null)
      .lte("next_follow_up_date", weekEnd)
      .order("next_follow_up_date", { ascending: true })
      .limit(50),
  ]);
  if (fc.error || fl.error) {
    notCovered.push({ what: "Follow-ups", why: "Next follow-up dates aren't available yet" });
  } else {
    const followups = [
      ...(fc.data ?? []).map((c) => ({
        due: c.next_follow_up_date as string,
        title: `Follow up with ${c.name}`,
        detail: [c.org_name, c.next_follow_up_note].filter(Boolean).join(" · ") || undefined,
        url: `${APP_URL}/contacts`,
      })),
      ...(fl.data ?? []).map((l) => ({
        due: l.next_follow_up_date as string,
        title: `Follow up with ${l.contact_name}`,
        detail: [l.company, l.next_follow_up_note, "conference lead"].filter(Boolean).join(" · "),
        url: `${APP_URL}/conferences`,
      })),
    ].sort((a, b) => a.due.localeCompare(b.due));
    const overdue = followups.filter((f) => f.due < today).length;
    followupsStat = ({
      label: "Follow-ups due",
      value: followups.length,
      url: `${APP_URL}/contacts`,
      hint: overdue ? `${overdue} overdue` : "next 7 days",
    });
    for (const f of followups.slice(0, 5)) {
      items.push({ kind: "followup", ...f, detail: f.due < today ? ["overdue", f.detail].filter(Boolean).join(" · ") : f.detail });
    }
  }

  // --- Touches in the last 7 days --------------------------------------
  const tp = await db
    .from("touchpoints")
    .select("id", { count: "exact", head: true })
    .gte("date", weekStart)
    .lt("date", addDays(today, 1));
  if (tp.error) notCovered.push({ what: "Touches", why: "Couldn't read outreach history" });
  else touchesStat = ({ label: "Touches this week", value: tp.count ?? 0, url: `${APP_URL}/contacts`, hint: "last 7 days" });

  items.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const stats = [meetingsStat, followupsStat, touchesStat, leadsStat].filter((x): x is Stat => !!x);
  return { headline, stats, items: items.slice(0, 10), notCovered };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { code: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(req, { code: "signed_out" }, 401);

  // Runs as the user: anon key + their JWT, so row-level security applies.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) return json(req, { code: "signed_out" }, 401);

  // Same approval check the database's own row-level security uses.
  const { data: approved } = await db.rpc("is_approved_user", { uid: user.id });
  if (approved !== true) {
    return json(req, { code: "not_member", message: "Your Hallway access hasn't been approved yet." }, 403);
  }

  const today = todayIn(new URL(req.url).searchParams.get("tz"));
  try {
    const summary = await summarize(db, today);
    return json(req, { app: "hallway", asOf: new Date().toISOString(), url: APP_URL, ...summary });
  } catch (e) {
    console.error("[suite-summary] failed:", e instanceof Error ? e.message : e);
    return json(req, { code: "error", message: "Couldn't build the Hallway summary" }, 500);
  }
});
