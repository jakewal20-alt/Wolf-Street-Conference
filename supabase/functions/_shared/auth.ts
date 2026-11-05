/**
 * Caller authentication and authorization for edge functions.
 *
 * `verify_jwt = true` in config.toml only proves the request carries *a* valid
 * JWT, and the public anon key is one. Every function that uses the service
 * role must therefore call `authenticate()` to resolve a real, approved user,
 * and check access to any record it touches (e.g. `requireConferenceAccess`).
 *
 * Usage:
 *   const auth = await authenticate(req, corsHeaders);
 *   if (auth instanceof Response) return auth;
 *   const denied = await requireConferenceAccess(auth, conferenceId, corsHeaders);
 *   if (denied) return denied;
 */
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  user: User;
  isAdmin: boolean;
  /** Service-role client. Bypasses RLS: only use after checking access. */
  admin: SupabaseClient;
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function authenticate(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const { data: profile } = await admin
    .from("profiles")
    .select("is_approved, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved) {
    return json({ error: "Account pending approval" }, 403, corsHeaders);
  }

  return { user, isAdmin: profile.is_admin === true, admin };
}

/** Owner, collaborator, or admin. Returns a 403/404 Response when denied, otherwise null. */
export async function requireConferenceAccess(
  auth: AuthContext,
  conferenceId: unknown,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (typeof conferenceId !== "string" || !conferenceId) {
    return json({ error: "Missing conference id" }, 400, corsHeaders);
  }
  if (auth.isAdmin) return null;

  const { data: allowed, error } = await auth.admin.rpc("can_access_conference", {
    conf_id: conferenceId,
    uid: auth.user.id,
  });
  if (error) {
    console.error("[auth] can_access_conference failed:", error.message);
    return json({ error: "Access check failed" }, 500, corsHeaders);
  }
  return allowed ? null : json({ error: "Conference not found" }, 404, corsHeaders);
}

/** Rejects oversized request payloads before they reach OpenAI. */
export function tooLarge(
  value: unknown,
  maxChars: number,
  corsHeaders: Record<string, string>,
): Response | null {
  if (typeof value === "string" && value.length > maxChars) {
    return json({ error: `Payload too large (max ${maxChars} characters)` }, 413, corsHeaders);
  }
  return null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
