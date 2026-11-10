/**
 * forecast-people — the people Forecast tracks on your pursuits, for Floor Mode.
 *
 * Hallway calls this with the signed-in user's JWT:
 *   GET /functions/v1/forecast-people
 * It asks Forecast's read-only suite route
 *   GET <FORECAST_URL>/api/suite/people?limit=200
 *   Authorization: Bearer <FORECAST_SUITE_TOKEN>
 * and returns { configured, available, people: [{ id, name, title, org, role, pursuits, programs, url }] }.
 * Floor Mode matches these against the conference's speakers and leads by name.
 *
 * Forecast's people belong to one company (FORECAST_ORG_SLUG, default "mavrc").
 * Once Hallway has companies, only members of that company get the list.
 * No emails or phone numbers: Forecast doesn't send them.
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

const STAGE_LABEL: Record<string, string> = {
  qualify: "Qualify", shape: "Shape", pursue: "Pursue", propose: "Propose",
  submitted: "Submitted", won: "Won", lost: "Lost", no_bid: "No bid",
};

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

  try {
    const res = await fetch(`${base}/api/suite/people?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[forecast-people] Forecast returned", res.status);
      return json({ configured: true, available: false, people: [] });
    }
    const body = await res.json();
    const people = (Array.isArray(body?.people) ? body.people : []).slice(0, 200).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ""),
      name: str(p.name, 120) ?? "",
      title: str(p.title),
      org: str(p.org),
      role: str(p.role, 40),
      pursuits: (Array.isArray(p.pursuits) ? p.pursuits : []).slice(0, 10).map((x: Record<string, unknown>) => ({
        name: str(x.name, 120) ?? "Pursuit",
        stage: typeof x.stage === "string" ? (STAGE_LABEL[x.stage] ?? x.stage) : null,
        linked: x.linked === true,
      })),
      programs: (Array.isArray(p.programs) ? p.programs : []).slice(0, 10)
        .map((x: Record<string, unknown>) => str(x.name, 120)).filter(Boolean),
      url: typeof p.url === "string" && /^https:\/\//.test(p.url) ? p.url : null,
    })).filter((p: { name: string }) => p.name);
    return json({ configured: true, available: true, people });
  } catch (e) {
    console.error("[forecast-people] request failed:", e instanceof Error ? e.message : e);
    return json({ configured: true, available: false, people: [] });
  }
});
