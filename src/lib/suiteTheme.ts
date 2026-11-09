import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Wolf Street theme contract (v1), shared by every suite app:
 * - localStorage "ws-theme" = "light" | "dark" (default light). next-themes
 *   stores Hallway's theme under the same key, so they stay in step.
 * - `?ws_theme=` on arrival (the bar adds it to cross-app links): save, apply, strip.
 * - window "wolfstreet:theme" events ({ detail: { theme } }) from the bar's switch.
 */
export const SUITE_THEME_KEY = "ws-theme";

/** Mount once inside ThemeProvider. */
export function SuiteThemeSync() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromLink = url.searchParams.get("ws_theme");
    if (fromLink === "light" || fromLink === "dark") setTheme(fromLink);
    if (url.searchParams.has("ws_theme")) {
      url.searchParams.delete("ws_theme");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }

    const onTheme = (e: Event) => {
      const theme = (e as CustomEvent<{ theme?: string }>).detail?.theme;
      if (theme === "light" || theme === "dark") setTheme(theme);
    };
    window.addEventListener("wolfstreet:theme", onTheme);
    return () => window.removeEventListener("wolfstreet:theme", onTheme);
  }, [setTheme]);

  return null;
}

/** True once the loaded <wolfstreet-bar> has its own light/dark switch. */
export function useBarHasThemeSwitch(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!import.meta.env.VITE_WOLFSTREET_BAR_URL) return;
    let cancelled = false;
    const check = () => {
      const ctor = customElements.get("wolfstreet-bar") as { observedAttributes?: string[] } | undefined;
      if (!cancelled) setHas(!!ctor?.observedAttributes?.includes("theme-toggle"));
    };
    check();
    customElements.whenDefined("wolfstreet-bar").then(check);
    return () => {
      cancelled = true;
    };
  }, []);
  return has;
}
