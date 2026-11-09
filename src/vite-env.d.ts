/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows Outlook sync on the Calendar (needs Microsoft credentials). */
  readonly VITE_OUTLOOK_ENABLED?: string;
  /** Shared Wolf Street suite bar script (wolfstreet-bar.js). Unset: no bar. */
  readonly VITE_WOLFSTREET_BAR_URL?: string;
  /** Wolf Street home page; a plain sign-in lands there. Has a default. */
  readonly VITE_WOLFSTREET_HOME_URL?: string;
}
