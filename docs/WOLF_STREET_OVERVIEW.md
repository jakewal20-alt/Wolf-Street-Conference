# Wolf Street: product, architecture and design overview

*November 5, 2026. Covers the `main` branch after PR #1 (security fixes). The design recommendations come from Gemini 3.1 Pro and are reviewed by Claude.*

---

## 1. What Wolf Street is

Wolf Street is a **conference and relationship intelligence** tool for business-development teams in government contracting. It captures who you met at an event and what was said, then turns that into follow-ups, a lead pipeline and an executive-ready briefing. It sits beside **SAMKLR**, which finds and scores federal opportunities. SAMKLR answers *what to pursue*; Wolf Street answers *who we know and what we said to them*.

**Who uses it**
- **BD reps on the conference floor**, who scan cards and record voice recaps on their phone.
- **BD leads and capture managers**, who triage leads, plan the team calendar and decide who attends which event.
- **Executives**, who read the AI briefing or a shared link.

---

## 2. Features by screen

| Screen | Route | What it does |
|---|---|---|
| **Today** | `/` | Daily command center: today's and upcoming events, quick capture (scan a card, add a conference), and jumps to the calendar, conferences and relationships. |
| **Calendar** | `/calendar` | Team calendar with month, week and day views. Covers event types, colors and icons, attendee avatars, conference travel days (added automatically), Outlook sync, calendar invites and an .ics export. |
| **Conferences** | `/conferences` | List of upcoming and past events. You can add one manually, **import it from a URL** (AI reads the event page) or import it from calendar events. |
| ↳ Conference detail | (in page) | **Leads** (new → contacted → qualified → converted / dropped), **AI business-card scan**, **voice recaps** (Whisper transcription plus an AI summary), **partner-notes analysis**, an **AI executive summary** (refine with feedback, export to PDF), a **lead report PDF**, **share link** (read-only, expires after 30 days), **attendee tagging** with email invites, and collaborators. |
| **Relationships** | `/contacts` | Contacts list, card upload, contact detail and an **outreach / touchpoint log**. |
| **Settings** | `/settings` | Profile and workspace preferences. |
| **Admin → Users** | `/admin/users` | Approve or delete users (admins only). |
| **Shared conference** | `/shared/:token` | Public read-only view: leads with no contact details, recap text and the executive summary. |
| **Auth** | `/auth` | Sign in, sign up and password reset. New accounts wait for admin approval. |

---

## 3. Architecture

```
Browser / installed phone app (React 18 + Vite + Tailwind + shadcn/ui + TanStack Query)
   │  supabase-js (row-level security applies)
   ▼
Supabase (project idsuahhfpkxylfmuidto)
   ├─ Postgres + row-level security: conferences, conference_leads, conference_voice_recaps,
   │    conference_share_links, conference_collaborators, conference_attendees,
   │    calendar_events, contacts, touchpoints, profiles (+ about 50 tables left over from Sam Scan AI)
   ├─ Storage: meeting-transcripts (private; files stored as {user_id}/...; signed URLs)
   ├─ Auth: email and password; profiles.is_approved / is_admin
   └─ Edge Functions (Deno), all checked by _shared/auth.ts
        AI (OpenAI): parse-business-card, voice-to-text, text-to-voice, summarize-voice-recap,
                     analyze-conference-notes, analyze-partner-notes, summarize-conference-exec,
                     refine-conference-summary, ingest-conference-from-url
        Export:      export-conference-summary-pdf, export-lead-report-pdf
        Email (Resend): send-calendar-invite, send-conference-attendance-invite
        Integrations: sync-to-outlook (Microsoft Graph), admin-delete-user
Hosting: Docker image → Railway (`serve -s dist`)
```

**How it's built**
- **Data access:** components and hooks call Supabase directly. There is no separate data layer.
- **AI:** the edge functions call OpenAI using the server's key. A shared prompt prefix (`bd-persona.ts`) sets the tone.
- **Teams:** every approved user is part of one shared team. There is **no separation between customer companies yet** (no `org_id`).

### Current health

| Area | Status |
|---|---|
| Security (critical items) | ✅ Fixed and deployed on Nov 5: admin escalation, share-link leak, public storage, open email relay, functions that didn't check who was calling |
| Separation between customer companies | ❌ Needed before a second customer: an `organizations` table plus `org_id` and membership-based database rules |
| Remaining security work | ⚠️ The URL-import function can be pointed at internal addresses, functions accept requests from any website, Outlook tokens are stored in the browser, and the offline cache keeps data after sign-out |
| Code quality | ⚠️ No tests, about 100 lint errors, a 1 MB single bundle, a 1,500-line `Calendar.tsx`, and two copies of the card-upload dialog |
| Bugs | ⚠️ Invalid .ics line endings, duplicate events from double clicks in calendar sync, refresh gaps in some screens, dark mode broken by hardcoded colors |
| Leftovers | Lovable README and `lovable-tagger`, about 50 unused tables, 4 unused shared modules, and a dead `/opportunity/:id` link |

---

## 4. Current design

| Token | Wolf Street today | SAMKLR (shipping app) |
|---|---|---|
| Page background | White `#ffffff`, `#f4f7fb` hardcoded | Warm off-white `#fcf9f8` |
| Sidebar | `#071522` (hardcoded) | Navy `#1d2b3e` |
| Primary | Blue `hsl(215 85% 25%)` | Navy `#1d2b3e` |
| Accent | Cyan `hsl(195 90% 50%)` | Tactical copper `#b8763d` |
| Display font | Space Grotesk | Archivo Narrow |
| Body font | Inter | Geist (numbers in Geist Mono) |
| Corner radius | 12px, up to 28px in places | 4px |
| Depth | Gradients, blurs, drop shadows | 1 to 1.5px outlines, layered tones |
| Dark mode | Toggle exists, but hardcoded colors break it | Stitch spec is dark-first; the app ships light |

They share almost nothing apart from a navy sidebar. Today Wolf Street looks like a polished consumer SaaS product, while SAMKLR looks like a precise defense tool.

---

## 5. Gemini's recommendations (summary)

**Shared across both products**
- Fonts: Archivo Narrow for headings, Geist for text, Geist Mono for numbers.
- Warm neutrals: `#fcf9f8` in light mode and `#131313` in dark mode.
- 4px corners, outlines instead of shadows, and the navy sidebar `#1d2b3e`.

**Wolf Street's own identity**
- A **Signal Blue** accent for everything to do with relationships.
- Copper appears in Wolf Street **only** when a contact is linked to a SAMKLR "Pursue" opportunity.

**Signature components**
- **Momentum Bar:** a 1.5px gauge of touchpoints over the last 30 days.
- **Action chips:** monospace follow-up urgency labels such as `[ T-24H ]` and `[ WAITING ]`.
- **Entity Linker:** a dashed line connecting a contact to a SAMKLR opportunity.

**Screen by screen**
- **Today:** a structured view without gradients, with a capture bar fixed to the bottom of the screen on phones.
- **Conferences list:** dense, table-like rows with dates and counts in monospace.
- **Conference detail:** a single continuous "briefing document" instead of separate cards.
- **Relationships:** square avatars.
- **Login:** match SAMKLR's centered login.
- **Capture flow:** large full-width buttons.

Gemini's full answer, including complete light and dark token blocks, is in [`docs/design/gemini-design-review.md`](design/gemini-design-review.md).

---

## 6. Review of Gemini's advice (Claude)

**Agree, and worth adopting:**
1. **Shared fonts, warm neutrals, 4px corners, outlines and the navy sidebar.** These matter most for making the two feel like one product family, and they're mostly token changes.
2. **Remove hardcoded colors first.** This also fixes dark mode. It's required before any theme work will take effect.
3. **Monospace for dates, counts and scores.**
4. **A thumb-reachable capture bar on phones**, for scanning a card or recording a recap.
5. **Signature components.** The Momentum Bar and follow-up urgency chips are the right counterpart to SAMKLR's Fit Score dial. The **contact-to-opportunity link** is the feature that makes the bundle worth more than the two products apart.
6. **Copper stays SAMKLR's.** It only appears in Wolf Street when it refers to a SAMKLR pursuit.

**Change before adopting:**
1. **Accent shade.** `#0284c7` fails WCAG AA for normal text: white on it is 4.1 to 1, and it on `#fcf9f8` is 3.9 to 1. Use **`#0369a1`** (`hsl(201 96% 32%)`) in light mode, which gives 5.9 and 5.7 to 1. Keep `#38bdf8` in dark mode, which gives 8.7 to 1 on `#131313`. SAMKLR has the same issue: white on copper is 3.7 to 1, so copper buttons need larger bold text or a darker shade (about `#9a5f2c`).
2. **Login page.** Don't drop the value-proposition column. Wolf Street is the newer product, and its login page doubles as a sales page. Restyle it with the shared tokens rather than replacing it with a "terminal" look.
3. **Forcing dark mode during capture.** Bright conference halls favor light, high-contrast screens. Use a dark camera frame for the card scanner only.
4. **Company logos.** `Contacts.tsx:69` uses `logo.clearbit.com`, which HubSpot has retired, so the logos are likely broken. Switch to initials in square tiles, or another logo service.
5. **Density.** Use compact rows on desktop, but keep 44px or larger touch targets on phones.

---

## 7. Recommended design rollout

| # | Change | Impact | Effort |
|---|---|---|---|
| 1 | Replace hardcoded colors in `AppSidebar`, `PageLayout`, `Today`, `Conferences` and `Auth` with theme tokens (fixes dark mode) | High | Low |
| 2 | Swap fonts: Archivo Narrow, Geist and Geist Mono | High | Low |
| 3 | Adopt the shared color tokens, with the corrected `#0369a1` accent | High | Low |
| 4 | Set `--radius` to 0.25rem and remove one-off `rounded-2xl`/`3xl`/`[28px]` | Medium | Low |
| 5 | Remove decorative gradients and blurs; switch to outline depth | Medium | Medium |
| 6 | Capture bar fixed to the bottom of the screen on phones (scan card, record recap) | High | Medium |
| 7 | Compact conferences list with monospace dates and counts | Medium | Medium |
| 8 | Restyle login with the shared tokens, keeping the value-proposition column | Medium | Medium |
| 9 | Replace Clearbit logos with square initial tiles | Low | Low |
| 10 | Momentum Bar and follow-up urgency chips on Relationships and Leads | High | High |
| 11 | Contact-to-SAMKLR-opportunity link (needs shared identity and a data contract) | High | High |

**For the bundle:** put the shared tokens into one small package, such as `@bacns/design-tokens` with CSS variables and the font setup, that both apps import. That stops them drifting apart again.
