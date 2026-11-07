/**
 * admin-invite-user — the only way new people get a Hallway / Wolf Street
 * account once public sign-up is turned off.
 *
 * POST { email, full_name? }   (admin only)
 *
 * - Creates the account with an invite link (auth.admin.generateLink), marks
 *   the profile approved, and tries to email the link through Resend.
 * - Always returns the link so the admin can copy and send it themselves:
 *   Resend may not deliver without a verified sending domain.
 * - Email already registered: approves it; if they've never signed in, sends a
 *   fresh set-your-password link (recovery) instead of failing.
 * - Sender: EMAIL_FROM_ADDRESS (must be on a domain verified in Resend).
 *
 * The link signs the person in and opens /reset-password, where they choose a
 * password. That URL must be in Supabase Auth > URL Configuration > Redirect URLs.
 */
import { Resend } from "https://esm.sh/resend@4.0.0";
import { authenticate, escapeHtml } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_APP_URL = "https://bacnswolfstreet.com";
const ALLOWED_ORIGINS = new Set([
  DEFAULT_APP_URL,
  "https://www.bacnswolfstreet.com",
  "http://localhost:8080",
]);
const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "Hallway <calendar@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;
  if (!auth.isAdmin) return json({ error: "Only admins can invite people" }, 403);

  let body: { email?: unknown; full_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 200) : "";
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return json({ error: "Enter a valid email address" }, 400);
  }

  const origin = req.headers.get("Origin") ?? "";
  const appUrl = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_APP_URL;
  const { admin } = auth;

  // Already has an account? Approve it. If they've never signed in (e.g. the
  // first invite email didn't arrive), send a fresh set-your-password link.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, is_approved")
    .ilike("email", email)
    .maybeSingle();

  let userId: string;
  let inviteUrl: string;
  let resent = false;

  if (existing) {
    if (!existing.is_approved) {
      const { error } = await admin.from("profiles").update({ is_approved: true }).eq("id", existing.id);
      if (error) return json({ error: "Could not approve the existing account" }, 500);
    }
    const { data: existingUser } = await admin.auth.admin.getUserById(existing.id);
    if (existingUser?.user?.last_sign_in_at) {
      return json({ status: "existing", approved: true });
    }
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${appUrl}/reset-password` },
    });
    if (linkError || !link?.properties?.action_link) {
      console.error("[admin-invite-user] recovery link failed:", linkError?.message);
      return json({ error: linkError?.message ?? "Could not create a new invite link" }, 400);
    }
    userId = existing.id;
    inviteUrl = link.properties.action_link;
    resent = true;
  } else {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: fullName ? { full_name: fullName } : {},
        redirectTo: `${appUrl}/reset-password`,
      },
    });
    if (linkError || !link?.user || !link.properties?.action_link) {
      console.error("[admin-invite-user] generateLink failed:", linkError?.message);
      return json({ error: linkError?.message ?? "Could not create the invite" }, 400);
    }
    userId = link.user.id;
    inviteUrl = link.properties.action_link;
  }

  // The new-user trigger creates the profile unapproved; the admin invited
  // them, so approve it. (Service role: the privilege trigger allows this.)
  const { error: approveError } = await admin
    .from("profiles")
    .update({ is_approved: true, ...(fullName ? { full_name: fullName } : {}) })
    .eq("id", userId);
  if (approveError) console.error("[admin-invite-user] approve failed:", approveError.message);

  let emailed = false;
  let emailError: string | null = null;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    emailError = "RESEND_API_KEY is not set";
  } else {
    const inviter = escapeHtml(auth.user.email ?? "Your team");
    const greeting = fullName ? `Hi ${escapeHtml(fullName)},` : "Hi,";
    const { error: sendError } = await new Resend(resendKey).emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: "You're invited to Hallway (Wolf Street)",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;color:#1d2b3e">
          <p>${greeting}</p>
          <p>${inviter} invited you to Hallway, the conference and relationship workspace in the Wolf Street suite.</p>
          <p><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#1d2b3e;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Accept invite and set a password</a></p>
          <p style="font-size:13px;color:#555">This link works once and expires in 24 hours. Your email and password also sign you in to the other Wolf Street apps you've been given access to.</p>
        </div>`,
    });
    if (sendError) {
      emailError = sendError.message;
      console.error("[admin-invite-user] email failed:", sendError.message, "from:", FROM_EMAIL);
    } else {
      emailed = true;
    }
  }

  return json({
    status: "invited",
    resent,
    approved: !approveError,
    emailed,
    email_error: emailError,
    invite_url: inviteUrl,
  });
});
