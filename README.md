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

## Edge functions

```sh
supabase functions deploy <name> --project-ref idsuahhfpkxylfmuidto
```

Every function that uses the service role must call `authenticate()` from `supabase/functions/_shared/auth.ts`, and check access to any record it touches. Fetch user-supplied URLs only through `_shared/safe-fetch.ts`.
