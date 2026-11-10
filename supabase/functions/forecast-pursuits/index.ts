/**
 * forecast-pursuits — Forecast pursuits linked to a Hallway conference.
 *
 * Hallway calls this with the signed-in user's JWT:
 *   GET /functions/v1/forecast-pursuits?conference_id=<uuid>
 * After checking the user can access that conference, it asks Forecast's
 * read-only suite route
 *   GET <FORECAST_URL>/api/suite/pursuits?source=hallway&externalId=<id>
 *   Authorization: Bearer <FORECAST_SUITE_TOKEN>
 * and returns { configured, pursuits: [{ id, name, stage, nextAction, nextActionDue, url }] }.
 *
 * Secrets: FORECAST_URL and FORECAST_SUITE_TOKEN (same value as Forecast's
 * env var). If either is missing it returns configured:false, so the UI
 * simply hides the section.
 */
import { authenticate, requireConferenceAccess } from "../_shared/auth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const conferenceId = new URL(req.url).searchParams.get("conference_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(conferenceId)) return json({ error: "conference_id required" }, 400);
  const denied = await requireConferenceAccess(auth, conferenceId, corsHeaders);
  if (denied) return denied;

  const base = (Deno.env.get("FORECAST_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("FORECAST_SUITE_TOKEN") ?? "";
  if (!base || token.length < 24) return json({ configured: false, pursuits: [] });

  try {
    const res = await fetch(
      `${base}/api/suite/pursuits?source=hallway&externalId=${encodeURIComponent(conferenceId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      console.error("[forecast-pursuits] Forecast returned", res.status);
      return json({ configured: true, available: false, pursuits: [] });
    }
    const body = await res.json();
    const pursuits = (Array.isArray(body?.pursuits) ? body.pursuits : []).slice(0, 20).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? "Pursuit"),
      stage: typeof p.stage === "string" ? (STAGE_LABEL[p.stage] ?? p.stage) : null,
      nextAction: typeof p.nextAction === "string" ? p.nextAction : null,
      nextActionDue: typeof p.nextActionDue === "string" ? p.nextActionDue.slice(0, 10) : null,
      url: typeof p.url === "string" && /^https:\/\//.test(p.url) ? p.url : null,
    }));
    return json({ configured: true, available: true, pursuits });
  } catch (e) {
    console.error("[forecast-pursuits] request failed:", e instanceof Error ? e.message : e);
    return json({ configured: true, available: false, pursuits: [] });
  }
});
