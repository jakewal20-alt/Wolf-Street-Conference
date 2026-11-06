import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndClear } from "@/lib/signOut";

/**
 * The Wolf Street suite bar: the shared <wolfstreet-bar> Web Component
 * (~/Developer/wolfstreet), loaded at runtime from VITE_WOLFSTREET_BAR_URL.
 *
 * Unset URL: renders nothing. Set but the script fails to load: the children
 * (a minimal strip with email + Sign out) show instead, so signing out never
 * depends on the Wolf Street service.
 */
const BAR_URL = import.meta.env.VITE_WOLFSTREET_BAR_URL as string | undefined;

function loadBarScript(url: string) {
  if (document.querySelector(`script[data-wolfstreet-bar]`)) return;
  const script = document.createElement("script");
  script.src = url;
  script.async = true;
  script.dataset.wolfstreetBar = "";
  document.head.appendChild(script);
}

export function WolfStreetBar() {
  const ref = useRef<HTMLElement>(null);
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    if (!BAR_URL) return;
    loadBarScript(BAR_URL);
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user.email ?? undefined));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user.email ?? undefined),
    );
    return () => subscription.unsubscribe();
  }, []);

  // React 18 doesn't wire custom events through props; attach directly.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = () => void signOutAndClear();
    el.addEventListener("wolfstreet-signout", handle);
    return () => el.removeEventListener("wolfstreet-signout", handle);
  }, []);

  if (!BAR_URL) return null;

  return (
    <wolfstreet-bar ref={ref} current="hallway" email={email} signout={email ? "" : undefined}>
      <div className="flex items-center gap-3 bg-[#1b2129] px-5 py-1 text-xs text-white/70">
        <span className="font-semibold uppercase tracking-widest text-white/60">Wolf Street</span>
        <span className="ml-auto truncate">{email}</span>
        {email && (
          <button className="underline hover:text-white" onClick={() => void signOutAndClear()}>
            Sign out
          </button>
        )}
      </div>
    </wolfstreet-bar>
  );
}
