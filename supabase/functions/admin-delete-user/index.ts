/**
 * admin-delete-user — remove someone from a Hallway company.
 *
 * POST { userId }   (company admin of that person's company, or platform admin)
 *
 * Hallway's accounts are the Wolf Street suite login, so this no longer
 * deletes the account itself (that would also lock the person out of
 * Forecast, SAMklr and the other apps). It removes their Hallway access:
 * no company, not approved, not admin. Their records stay with the company.
 * To delete a login entirely, use the Supabase dashboard.
 */
import { authenticate } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;
  if (!auth.isAdmin && !auth.isPlatformAdmin) {
    return json({ success: false, error: "Only admins can remove people" }, 403);
  }

  let userId: unknown;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }
  if (typeof userId !== "string" || !userId) return json({ success: false, error: "No userId provided" }, 400);
  if (userId === auth.user.id) return json({ success: false, error: "You can't remove yourself" }, 400);

  const { data: target } = await auth.admin
    .from("profiles")
    .select("id, org_id, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!target || (!auth.isPlatformAdmin && target.org_id !== auth.orgId)) {
    return json({ success: false, error: "User not found" }, 404);
  }
  if (target.is_platform_admin) {
    return json({ success: false, error: "The platform admin can't be removed here" }, 403);
  }

  const { error } = await auth.admin
    .from("profiles")
    .update({ org_id: null, is_approved: false, is_admin: false })
    .eq("id", userId);
  if (error) {
    console.error("[admin-delete-user] remove failed:", error.message);
    return json({ success: false, error: "Could not remove this person" }, 500);
  }
  return json({ success: true });
});
