/**
 * forecast-companies — companies tied to your Forecast pursuits, for Floor Mode's
 * "Booths to visit".
 *
 * Hallway calls this with the signed-in user's JWT:
 *   GET /functions/v1/forecast-companies
 * It asks Forecast's read-only suite route
 *   GET <FORECAST_URL>/api/suite/companies
 *   Authorization: Bearer <FORECAST_SUITE_TOKEN>
 * and returns {
 *   configured, available,
 *   pursuits:  [{ id, name, stage, program, service, url }],
 *   companies: [{ name, role: "incumbent" | "recipient", detail, obligated, pursuit: { id, name, service, url } }],
 * }.
 * Floor Mode matches the companies against the conference's exhibitor list,
 * and Army / Navy / Air Force pursuits against that service's booths.
 *
 * Forecast's data belongs to one company (FORECAST_ORG_SLUG, default "mavrc");
 * same gate as forecast-people.
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

const httpsUrl = (v: unknown): string | null => (typeof v === "string" && /^https:\/\//.test(v) ? v : null);

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

function pursuitOut(p: Record<string, unknown>) {
  return {
    id: String(p?.id ?? ""),
    name: str(p?.name, 160) ?? "Pursuit",
    stage: typeof p?.stage === "string" ? (STAGE_LABEL[p.stage] ?? p.stage) : null,
    program: str(p?.program, 160),
    service: str(p?.service, 40),
    url: httpsUrl(p?.url),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const empty = { pursuits: [], companies: [] };
  if (!(await inForecastCompany(auth.admin, auth.user.id))) return json({ configured: false, ...empty });

  const base = (Deno.env.get("FORECAST_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("FORECAST_SUITE_TOKEN") ?? "";
  if (!base || token.length < 24) return json({ configured: false, ...empty });

  try {
    const res = await fetch(`${base}/api/suite/companies`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // 404 until Forecast ships the route.
      console.error("[forecast-companies] Forecast returned", res.status);
      return json({ configured: true, available: false, ...empty });
    }
    const body = await res.json();
    const pursuits = (Array.isArray(body?.pursuits) ? body.pursuits : []).slice(0, 100).map(pursuitOut);
    const companies = (Array.isArray(body?.companies) ? body.companies : []).slice(0, 500)
      .map((c: Record<string, unknown>) => ({
        name: str(c.name, 200) ?? "",
        role: c.role === "incumbent" ? "incumbent" : "recipient",
        detail: str(c.detail, 240),
        obligated: typeof c.obligated === "number" && Number.isFinite(c.obligated) ? c.obligated : null,
        pursuit: pursuitOut(c.pursuit as Record<string, unknown>),
      }))
      .filter((c: { name: string }) => c.name);
    return json({ configured: true, available: true, pursuits, companies });
  } catch (e) {
    console.error("[forecast-companies] request failed:", e instanceof Error ? e.message : e);
    return json({ configured: true, available: false, ...empty });
  }
});
