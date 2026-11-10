import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SUITE_THEME_KEY, SuiteThemeSync } from "@/lib/suiteTheme";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { installFriendlyFunctionErrors } from "@/lib/friendlyFunctionErrors";

installFriendlyFunctionErrors();

// A new service worker takes over right after a deploy, but the page that's
// already open is still the old build. Reload once when that happens soon
// after load, so people don't run one release behind. Later takeovers are
// left for the next visit, so nobody loses work mid-edit.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  const loadedAt = Date.now();
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || Date.now() - loadedAt > 15_000) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey={SUITE_THEME_KEY} enableSystem>
    <SuiteThemeSync />
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </ThemeProvider>
);
