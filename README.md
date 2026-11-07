# Hallway

**Conference and relationship intelligence. Part of the Wolf Street BD suite.**

Hallway answers *where will the people be, and how do we work the room?* It covers conferences and events, the team calendar, leads captured at events (business-card scan, voice recaps), contacts and touchpoints, AI executive summaries, and share links.

Other apps in the Wolf Street suite:
- **SAMklr**: posted federal opportunities, scoring, and pursue decisions.
- **Forecast**: where DoD money is going, and the people behind the programs.

Hallway doesn't do budget forecasting or opportunity scoring; it takes those from Forecast and SAMklr.

- Live: https://bacnswolfstreet.com
- Overview, architecture and design decisions: [`docs/HALLWAY_OVERVIEW.md`](docs/HALLWAY_OVERVIEW.md)

> The repository and the Supabase project are still named "Wolf-Street-Conference" from before the rename.

## Stack

- React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- Supabase project `idsuahhfpkxylfmuidto`: Postgres with row-level security, Auth, Storage (private `meeting-transcripts` bucket), and Edge Functions (Deno)
- AI: OpenAI, called from edge functions only. Email: Resend.
- Hosting: Railway (Dockerfile). Merging to `main` deploys.

## Development

```sh
npm install
npm run dev          # http://localhost:8080 (uses the live Supabase project)
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
```

`.env` holds only the public Supabase URL and publishable key. Server secrets (OpenAI, Resend, service role) live in Supabase function secrets.

## Database changes

Migrations live in `supabase/migrations/`. Production was originally built from `supabase/clean_schema.sql`, so apply new migrations by pasting them into the Supabase SQL Editor. Run the whole file with nothing highlighted. Every migration is written to be safe to run more than once.

## Accounts (invite-only)

Hallway's Supabase Auth is the single login for the Wolf Street suite: Forecast signs people in against this project with the public publishable key. Don't rotate that key, or switch JWT signing keys, without updating Forecast.

Public sign-up is off. Admins invite people from **Users** (the `admin-invite-user` function). Invited accounts are approved automatically, and the invite link opens `/reset-password` so the person can choose a password.

## Wolf Street single sign-on

Hallway is the sign-in point for the suite. Another app with no session sends the browser to `https://bacnswolfstreet.com/sso?app=forecast|samklr&return=<url>`. Hallway signs the person in if needed, then the `sso-handoff` function returns a one-time magic-link code. The browser goes back to `<return>#wolfstreet_sso=<code>`, and the app exchanges the code with `verifyOtp({ token_hash, type: "magiclink" })` for its own session. Refresh tokens are never shared between apps.

Return addresses must match the `SSO_ALLOWED_ORIGINS` secret (comma-separated origins). If it's unset, SSO is off.

## Wolf Street suite bar

The thin bar on top (Forecast · SAMklr · Hallway) is the shared `<wolfstreet-bar>` component from the `wolfstreet` repo, loaded at runtime from `VITE_WOLFSTREET_BAR_URL`. If that's unset, there's no bar. On Railway, set it as a service variable (the Dockerfile passes it to the build) and redeploy. Locally: `VITE_WOLFSTREET_BAR_URL=http://localhost:4400/wolfstreet-bar.js npm run dev`, with `npm start` running in the `wolfstreet` repo.

## Edge functions

```sh
supabase functions deploy <name> --project-ref idsuahhfpkxylfmuidto
```

Every function that uses the service role must call `authenticate()` from `supabase/functions/_shared/auth.ts`, and check access to any record it touches. Fetch user-supplied URLs only through `_shared/safe-fetch.ts`.
