import { supabase } from "@/integrations/supabase/client";

/**
 * Sign out and remove anything that could leak the previous user's data on a
 * shared device: the legacy service-worker cache of Supabase responses (older
 * builds cached them for 24h), Outlook tokens, and in-memory query caches
 * (cleared by the full page load to /auth).
 */
export async function signOutAndClear(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } finally {
    try {
      if ("caches" in window) await caches.delete("supabase-cache");
    } catch {
      // ignore: cache API unavailable (e.g. private mode)
    }
    localStorage.removeItem("outlook_tokens");
    sessionStorage.removeItem("outlook_oauth_state");
    window.location.assign("/auth");
  }
}
