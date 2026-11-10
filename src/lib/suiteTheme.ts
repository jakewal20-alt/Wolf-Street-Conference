import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Wolf Street theme contract (v1.2), shared by every suite app:
 * - With no choice made, follow the computer/browser (prefers-color-scheme), live.
 * - An explicit choice lives in localStorage "ws-theme-pref" = "light" | "dark",
 *   written only when someone clicks the bar's switch or arrives with ?ws_theme=.
 *   next-themes stores Hallway's choice under the same key ("system" when unset).
 * - `?ws_theme=` on arrival (the bar adds it to cross-app links): save, apply, strip.
 * - window "wolfstreet:theme" events from the bar: apply only if a choice is saved;
 *   otherwise next-themes is already following the OS, same as the bar.
 * The old "ws-theme" key (v1.1) was written on every load, so it's ignored.
 */
export const SUITE_THEME_KEY = "ws-theme-pref";

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
      // The bar announces the OS-derived theme on load too; only an explicit
      // choice (saved by the bar's click on this origin) becomes Hallway's.
      const pref = localStorage.getItem(SUITE_THEME_KEY);
      if ((theme === "light" || theme === "dark") && (pref === "light" || pref === "dark")) setTheme(theme);
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
