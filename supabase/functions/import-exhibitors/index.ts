/**
 * import-exhibitors: add a conference's exhibitors (company + booth) from its
 * exhibitor directory. POST { conference_id, url, page_text? }.
 *
 * Reads the URL, or text the user copied from the page in their own browser
 * (directories that page by script or refuse server reads). Adds only booths
 * not already saved, so a long directory can be pasted one page at a time.
 * Returns { success, added, found, total }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticate, requireConferenceAccess } from "../_shared/auth.ts";
import { safeFetchText, UnsafeUrlError } from "../_shared/safe-fetch.ts";
import { parseExhibitors } from "./parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const auth = await authenticate(req, corsHeaders);
  if (auth instanceof Response) return auth;

  let body: { conference_id?: unknown; url?: unknown; page_text?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const conferenceId = typeof body.conference_id === "string" && UUID.test(body.conference_id) ? body.conference_id : null;
  if (!conferenceId) return json({ success: false, error: "Missing conference id" }, 400);
  const denied = await requireConferenceAccess(auth, conferenceId, corsHeaders);
  if (denied) return denied;

  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  const pageText = typeof body.page_text === "string" && body.page_text.trim() ? body.page_text.slice(0, 400_000) : null;
  if (!pageText && !/^https?:\/\//i.test(url)) {
    return json({ success: false, error: "Give the exhibitor directory's URL, or paste its text" }, 400);
  }

  let source = pageText;
  if (!source) {
    try {
      const fetched = await safeFetchText(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Hallway/1.0; conference exhibitor import)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!fetched.response.ok) {
        return json({ success: false, needs_paste: true, error: "That site wouldn't let Hallway read the page. Paste its text instead." }, 422);
      }
      source = fetched.text;
    } catch (e) {
      if (e instanceof UnsafeUrlError) return json({ success: false, error: e.message }, 400);
      console.error("[import-exhibitors] fetch failed:", e instanceof Error ? e.message : e);
      return json({ success: false, needs_paste: true, error: "Hallway couldn't open that page. Paste its text instead." }, 422);
    }
  }

  const found = parseExhibitors(source).slice(0, 3000);
  if (found.length === 0) {
    return json({
      success: false,
      needs_paste: !pageText,
      error: pageText
        ? "Hallway didn't find any booth numbers in that text. Copy the exhibitor list itself (names with \"Booth #…\")."
        : "Hallway didn't find booth numbers on that page. Open it, select all, copy, and paste the text instead.",
    }, 422);
  }

  const { data: existing, error: readError } = await auth.admin
    .from("conference_exhibitors")
    .select("name,booth")
    .eq("conference_id", conferenceId)
    .limit(5000);
  if (readError) {
    console.error("[import-exhibitors] read failed:", readError.message);
    return json({ success: false, error: "Exhibitors aren't set up yet (database update pending)." }, 503);
  }
  const have = new Set((existing ?? []).map((e) => `${String(e.name).toLowerCase()}|${e.booth ?? ""}`));

  const rows = found
    .filter((e) => !have.has(`${e.name.toLowerCase()}|${e.booth ?? ""}`))
    .map((e) => ({
      conference_id: conferenceId,
      name: e.name,
      booth: e.booth,
      source_url: url || null,
      created_by: auth.user.id,
    }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await auth.admin.from("conference_exhibitors").insert(rows.slice(i, i + 500));
    if (error) {
      console.error("[import-exhibitors] insert failed:", error.message);
      return json({ success: false, error: "Couldn't save the exhibitors" }, 500);
    }
  }

  return json({ success: true, added: rows.length, found: found.length, total: have.size + rows.length });
});
