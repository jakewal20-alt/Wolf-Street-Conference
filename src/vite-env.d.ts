/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows Outlook sync on the Calendar (needs Microsoft credentials). */
  readonly VITE_OUTLOOK_ENABLED?: string;
  /** Shared Wolf Street suite bar script (wolfstreet-bar.js). Unset: no bar. */
  readonly VITE_WOLFSTREET_BAR_URL?: string;
}
