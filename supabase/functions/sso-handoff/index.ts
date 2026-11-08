/**
 * sso-handoff — Wolf Street single sign-on (contract: wolfstreet-sso.md).
 *
 * Hallway's /sso page calls this with the signed-in user's JWT and the other
 * app's return URL. It returns a one-time magic-link token hash, which the
 * other app exchanges for its OWN session with
 * verifyOtp({ token_hash, type: "magiclink" }). Refresh tokens are never shared.
 *
 * POST { app: "forecast" | "samklr" | "ghostwriter" | "wolfstreet", return: "<absolute URL>" }
 * → { redirect: "<return URL without fragment>#wolfstreet_sso=<hashed_token>" }
 *
 * - The return URL's origin must be listed exactly in the SSO_ALLOWED_ORIGINS
 *   secret (comma-separated). Unset → the endpoint is disabled (fails closed).
 * - No email is sent. The token is single-use and short-lived.
 * - Identity only: each app still checks its own member list.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPS = new Set(["forecast", "samklr", "ghostwriter", "wolfstreet"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("SSO_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origins = allowedOrigins();
  if (origins.size === 0) {
    console.error("[sso-handoff] SSO_ALLOWED_ORIGINS not set; endpoint disabled");
    return json({ error: "Single sign-on is not configured" }, 503);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

  let body: { app?: unknown; return?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (typeof body.app !== "string" || !APPS.has(body.app)) {
    return json({ error: "Unknown app" }, 400);
  }

  let returnUrl: URL;
  try {
    returnUrl = new URL(String(body.return ?? ""));
  } catch {
    return json({ error: "Invalid return URL" }, 400);
  }
  if (!origins.has(returnUrl.origin)) {
    console.warn("[sso-handoff] rejected return origin:", returnUrl.origin);
    return json({ error: "Return address is not allowed" }, 403);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) {
    console.error("[sso-handoff] generateLink failed:", linkError?.message);
    return json({ error: "Could not create a sign-in code" }, 500);
  }

  returnUrl.hash = "";
  const redirect = `${returnUrl.toString()}#wolfstreet_sso=${encodeURIComponent(hashed)}`;
  console.log("[sso-handoff] issued", { app: body.app, user: user.id, origin: returnUrl.origin });
  return json({ redirect });
});
