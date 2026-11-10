/**
 * forecast-directory — search Wolf Street's government contact directory from Hallway.
 *
 * Hallway calls this with the signed-in user's JWT:
 *   GET /functions/v1/forecast-directory?q=<name, office, code>&line=<PE or BLI>&office=<id>
 * It asks Forecast's read-only suite route
 *   GET <FORECAST_URL>/api/suite/directory?q=&line=&office=&limit=50
 *   Authorization: Bearer <FORECAST_SUITE_TOKEN>
 * and returns { configured, available, people: [{ id, name, title, role, office, officeParent,
 *   email, phone, publishedOn, publishedAt, lastSeen, stale, lines, url }] }.
 *
 * The directory holds only official-capacity contacts published on SAM.gov notices, DSIP topics,
 * Grants.gov and conference agendas. Email and phone are shown as published, with the source and date.
 * Forecast's data belongs to one company (FORECAST_ORG_SLUG, default "mavrc"); only its members get it.
 */
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** True when this user may see Forecast's company data. */
async function inForecastCompany(
  admin: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (error) {
    // Before the companies migration there is no org_id column and every
    // Hallway user is MAVRC. Any other error: deny.
    return /org_id/.test(error.message ?? "") && /(does not exist|Could not find)/i.test(error.message ?? "");
  }
  if (!data?.org_id) return false;
  const { data: org } = await admin.from("organizations").select("slug").eq("id", data.org_id).maybeSingle();
  return org?.slug === (Deno.env.get("FORECAST_ORG_SLUG") || "mavrc");
}


const SOURCE: Record<string, string> = { sam: "SAM.gov", dsip: "DSIP", grants: "Grants.gov", hallway: "Hallway agenda" };
const clean = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;

  if (!(await inForecastCompany(auth.admin, auth.user.id))) {
    return json({ configured: false, people: [] });
  }

  const base = (Deno.env.get("FORECAST_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("FORECAST_SUITE_TOKEN") ?? "";
  if (!base || token.length < 24) return json({ configured: false, people: [] });

  const url = new URL(req.url);
  const params = new URLSearchParams({ limit: "50" });
  const q = clean(url.searchParams.get("q"));
  const line = clean(url.searchParams.get("line"), 20);
  const office = clean(url.searchParams.get("office"), 12);
  if (q) params.set("q", q);
  if (/^[A-Za-z0-9-]{1,20}$/.test(line)) params.set("line", line);
  if (/^\d+$/.test(office)) params.set("office", office);

  try {
    const res = await fetch(`${base}/api/suite/directory?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[forecast-directory] Forecast returned", res.status);
      return json({ configured: true, available: false, people: [] });
    }
    const body = await res.json();
    const people = (Array.isArray(body?.people) ? body.people : []).slice(0, 50).map((p: Record<string, any>) => {
      const published = p.email ?? p.phone ?? null;
      return {
        id: String(p.id ?? ""),
        name: str(p.name, 120) ?? "",
        title: str(p.title),
        role: str(p.role, 40),
        office: str(p.office?.name) ?? str(p.officePath),
        officeParent: str(p.office?.parent?.name),
        email: str(p.email?.value, 160),
        phone: str(p.phone?.value, 40),
        publishedOn: published ? (SOURCE[published.source] ?? str(published.source, 40)) : null,
        publishedAt: published ? str(published.seenAt, 40) : null,
        lastSeen: str(p.lastSeen, 40),
        stale: p.stale === true,
        lines: (Array.isArray(p.lines) ? p.lines : []).slice(0, 8).map((x: unknown) => str(x, 20)).filter(Boolean),
        url: `${base}/#/directory`,
      };
    }).filter((p: { name: string }) => p.name);
    return json({ configured: true, available: true, people });
  } catch (e) {
    console.error("[forecast-directory] request failed:", e instanceof Error ? e.message : e);
    return json({ configured: true, available: false, people: [] });
  }
});
