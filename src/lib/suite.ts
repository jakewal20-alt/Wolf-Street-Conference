/**
 * The Wolf Street home page ("Today across Wolf Street"). A plain sign-in
 * lands there; a sign-in that came from another app returns to that app.
 * Override with VITE_WOLFSTREET_HOME_URL (e.g. for a custom domain).
 */
export const WOLFSTREET_HOME_URL =
  import.meta.env.VITE_WOLFSTREET_HOME_URL || "https://wolfstreet-production.up.railway.app/";

/** Hallway path that signs the person into the home page through SSO. */
export const WOLFSTREET_HOME_SSO_PATH = `/sso?app=wolfstreet&return=${encodeURIComponent(WOLFSTREET_HOME_URL)}`;
