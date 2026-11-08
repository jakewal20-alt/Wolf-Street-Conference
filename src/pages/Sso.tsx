import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * /sso?app=forecast|samklr|ghostwriter|wolfstreet&return=<url> — Wolf Street single sign-on.
 *
 * Signed in → ask sso-handoff for a one-time code and send the browser back to
 * the app with it. Not signed in → Hallway's sign-in, then back here.
 * The server checks the return address against its allow list.
 */
const APP_NAMES: Record<string, string> = { forecast: "Forecast", samklr: "SAMklr", ghostwriter: "Ghostwriter", wolfstreet: "Wolf Street" };

export default function Sso() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const app = params.get("app") ?? "";
  const returnUrl = params.get("return") ?? "";
  const appName = APP_NAMES[app];

  useEffect(() => {
    if (!appName || !returnUrl) {
      setError("This sign-in link is incomplete. Go back to the app and try again.");
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const next = `/sso?${params.toString()}`;
        navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("sso-handoff", {
        body: { app, return: returnUrl },
      });
      if (cancelled) return;
      if (fnError || !data?.redirect) {
        // HTTP errors carry the Response; network errors carry something else.
        const ctx = (fnError as { context?: unknown } | null)?.context;
        const detail = ctx instanceof Response ? await ctx.json().catch(() => null) : null;
        setError(detail?.error ?? "Couldn't sign you in. Try again from the app.");
        return;
      }
      window.location.replace(data.redirect as string);
    })();

    return () => {
      cancelled = true;
    };
  }, [app, appName, returnUrl, params, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-inverse px-6 text-inverse-foreground">
      <div className="max-w-sm text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary">Wolf Street</p>
        {error ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold">Sign-in didn't go through</h1>
            <p className="mt-2 text-sm text-inverse-foreground/80">{error}</p>
            <Button className="mt-6" variant="secondary" onClick={() => navigate("/")}>Go to Hallway</Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-sidebar-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Signing you in to {appName ?? "the app"}…</h1>
          </>
        )}
      </div>
    </div>
  );
}
