> *Gemini 3.1 Pro output, Nov 5, 2026, kept verbatim. Since then, "Wolf Street" has become the name of the suite, and the app reviewed here is called **Hallway**. See `docs/HALLWAY_OVERVIEW.md` for the reviewed recommendations.*

Here is a concrete design strategy to align Wolf Street with the SAMKLR suite while optimizing it for its specific field-intelligence use case. 

### 1. Assessment of Wolf Street's Current Design
*   **Hierarchy & Density:** Wolf Street currently feels like a consumer SaaS product. The use of large border radii (up to 28px), heavy blur shadows, and large gradient backgrounds (`Today.tsx`, `Auth.tsx`) wastes screen real estate and fights the "Defense Credibility" aesthetic of its sister app. 
*   **Consistency:** The hardcoded colors throughout the layouts (e.g., `#071522` in `AppSidebar.tsx`, `#f4f7fb` in `PageLayout.tsx`) break the theming engine and prevent dark mode from working. 
*   **Mobile Ergonomics:** For an app meant to be used on a busy conference floor, large glossy cards and soft gradients create glare issues. The interface needs to be high-contrast, strictly structured, and highly legible at a glance, with prominent, easy-to-reach tap targets for quick capture.

### 2. Family Cohesion Strategy
Wolf Street and SAMKLR should look like they run on the same proprietary operating system—authoritative, precise, and data-dense.

**What must be SHARED (The OS Foundation):**
*   **Typography:** Drop *Inter* and *Space Grotesk*. Use **Archivo Narrow** for headlines/display and **Geist** for UI/body. 
*   **Base Neutrals:** Share SAMKLR’s warm off-white surface in light mode (`#fcf9f8`) and warm slate base in dark mode (`#131313`). 
*   **Structural Identity:** Use a rigid **4px (0.25rem) radius** for all cards and buttons. Remove all soft drop-shadows and replace them with **1px or 1.5px solid borders** (`border-border`) to create tonal layering.
*   **Sidebar:** Share the exact same Navy primary color for the sidebar background (`#1d2b3e`).

**What must be DISTINCT (The Wolf Street Identity):**
*   **Signature Accent:** Where SAMKLR uses Tactical Copper (`#b8763d`) for procurement "Pursue" decisions, Wolf Street should use a **Signal Blue** (`#0284c7` / HSL `200 98% 39%`). This maintains the technical, authoritative feel while differentiating relationship-building (Blue) from procurement strategy (Copper). Copper should still be used in Wolf Street *only* when linking a contact directly to a SAMKLR "Pursue" opportunity.

### 3. Token Proposal (shadcn/ui & Tailwind)
Replace the contents of `index.css` with these precision-engineered variables, using SAMKLR's base values translated to HSL.

```css
@layer base {
  :root {
    /* SAMKLR Shared: Warm Off-White Surfaces */
    --background: 15 24% 98%;      /* #fcf9f8 */
    --foreground: 0 2% 11%;        /* #1c1b1b */
    --card: 15 21% 95%;            /* #f5f1ef */
    --card-foreground: 0 2% 11%;
    --popover: 0 0% 100%;          /* #ffffff */
    --popover-foreground: 0 2% 11%;

    /* SAMKLR Shared: Navy Chart Blue */
    --primary: 215 36% 18%;        /* #1d2b3e */
    --primary-foreground: 0 0% 100%;
    
    /* Wolf Street Distinct: Signal Blue */
    --accent: 200 98% 39%;         /* #0284c7 */
    --accent-foreground: 0 0% 100%;

    --secondary: 15 15% 90%;
    --secondary-foreground: 215 36% 18%;
    --muted: 15 15% 92%;
    --muted-foreground: 30 5% 40%;
    
    --destructive: 3 49% 40%;      /* #9a3934 */
    --destructive-foreground: 0 0% 100%;
    
    --border: 25 15% 89%;          /* #e5e0dc */
    --input: 25 15% 89%;
    --ring: 200 98% 39%;

    /* Precision structural rounding */
    --radius: 0.25rem;

    /* Sidebar - Navy */
    --sidebar-background: 215 36% 18%;
    --sidebar-foreground: 220 14% 96%;
    --sidebar-primary: 200 98% 39%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 215 30% 25%;
    --sidebar-accent-foreground: 220 14% 96%;
    --sidebar-border: 215 30% 22%;
    --sidebar-ring: 200 98% 39%;
  }

  .dark {
    /* SAMKLR Shared: Warm Dark Gray */
    --background: 0 0% 7%;         /* #131313 */
    --foreground: 10 5% 90%;       /* #e5e2e1 */
    --card: 0 0% 11%;              /* #1c1b1b */
    --card-foreground: 10 5% 90%;
    --popover: 0 0% 16%;           /* #2a2a2a */
    --popover-foreground: 10 5% 90%;
    
    --primary: 221 34% 80%;        /* #b9c7e0 */
    --primary-foreground: 215 32% 14%;
    
    /* Wolf Street Distinct: Bright Signal Blue for Dark Mode */
    --accent: 200 95% 59%;         /* #38bdf8 */
    --accent-foreground: 215 32% 14%;

    --secondary: 0 0% 21%;         /* #353535 */
    --secondary-foreground: 10 5% 90%;
    --muted: 0 0% 16%;
    --muted-foreground: 230 7% 79%;
    
    --destructive: 3 100% 64%;     /* #ffb4ab */
    --destructive-foreground: 358 100% 21%;

    --border: 217 6% 28%;          /* #44474c */
    --input: 217 6% 28%;
    --ring: 200 95% 59%;
    
    /* Sidebar matches background in dark mode */
    --sidebar-background: 0 0% 7%;
    --sidebar-foreground: 10 5% 90%;
    --sidebar-border: 217 6% 28%;
  }
}
```

**Tailwind Config Update (`tailwind.config.ts`):**
```typescript
fontFamily: {
  sans: ['Geist', 'system-ui', 'sans-serif'],
  display: ['Archivo Narrow', 'system-ui', 'sans-serif'],
  mono: ['Geist Mono', 'monospace'],
},
```

### 4. Screen-by-Screen Recommendations

*   **Today (Command Center):** Remove the 28px border-radius gradients and blur effects. Convert the top header into a highly structured "Terminal" view. Use a 1.5px border outline. For the "Quick capture" buttons, lock them to a sticky bottom bar on mobile viewports so users can always reach "Scan Card" or "Record Recap" with their thumb without scrolling.
*   **Conferences (List):** Replace the large, padded cards with a high-density table or compact list cards (32px or 48px row heights). Use `Geist Mono` for dates and attendee counts so the numbers align perfectly down the column.
*   **Conference Detail (Executive Summary):** The current layout uses too many disconnected, slightly-transparent cards. Unify this into a continuous "Briefing Document" layout resembling a stark white piece of paper (or dark grey surface in dark mode) with strict 1px divider lines. The "Top Leads" should feel like a datagrid rather than isolated bubbles.
*   **Relationships (Contacts):** The Clearbit avatars are currently circles. Change them to 4px rounded squares. It feels much more like a technical database and aligns with the strict geometry of the brand.
*   **Login / Auth:** Discard the consumer-friendly split layout with the blue gradients and marketing copy. Replicate SAMKLR's login entirely: a dark, centered terminal window with fixed-width labels, mono-spaced inputs, and a strict, distraction-free environment. 
*   **Mobile Capture Flow (Card Scan / Voice):** Force these specific routes into Dark Mode regardless of system preference. When on a bright conference floor, a dark UI frames the camera better and reduces battery drain. Use massive, full-width buttons for "Start Recording" or "Snap Card".

### 5. Signature Components for Wolf Street

Just as SAMKLR has its "Fit Score dial", Wolf Street needs proprietary UI elements that communicate relationship momentum:

1.  **The Momentum Bar:** A horizontal 1.5px gauge (using the Signal Blue) indicating the density of touchpoints over the last 30 days. It replaces generic "warm/cold" text with a strict, visual data metric.
2.  **Action Matrix Chips:** Square, mono-spaced badges with rigid outlines indicating follow-up urgency (e.g., `[ T-24H ]` for 24-hour follow-up, `[ WAITING ]` for blocked). 
3.  **Entity Linker:** A visual "pipe" or connection line (1px stroke, dashed) that visually connects a Wolf Street `Contact` to a SAMKLR `Opportunity` inside the detail views, bridging the two products.

### 6. Prioritized Change List (Impact / Effort)

1.  **Remove Hardcoded Colors:** (High Impact / Low Effort) Scrub `AppSidebar.tsx`, `PageLayout.tsx`, and `Auth.tsx` of hardcoded hexes (`#071522`, `#f4f7fb`) and replace them with standard shadcn variables (`bg-sidebar`, `bg-background`). 
2.  **Apply Font Swaps:** (High Impact / Low Effort) Swap Inter/Space Grotesk to Geist/Archivo Narrow globally to instantly align the brand voice.
3.  **Update CSS Tokens:** (High Impact / Low Effort) Drop in the provided HSL variables to unify the light/dark modes with SAMKLR's baseline.
4.  **Enforce 4px Radius:** (Medium Impact / Low Effort) Change the global `--radius` to `0.25rem`. Find and replace all one-off `rounded-2xl`, `rounded-3xl`, and `rounded-[28px]` utility classes in the codebase.
5.  **Remove Blurs & Gradients:** (Medium Impact / Medium Effort) Strip out all `blur-3xl` background blobs and `bg-gradient-to-r` decorations from the Dashboard and Login screens.
6.  **Redesign Login Screen:** (High Impact / Medium Effort) Delete the promotional left column. Center a strictly functional, dark-themed login card.
7.  **Optimize Mobile Action Bar:** (High Impact / Medium Effort) Move the "Scan Card" and "Capture Recap" buttons on the `Today.tsx` view to a fixed `bottom-0` sticky bar for mobile users.
8.  **Compact the Conference List:** (Medium Impact / Medium Effort) Reduce padding in `Conferences.tsx` cards and implement a table-like structure for scanning dates.
9.  **Square Avatars:** (Low Impact / Low Effort) Update `Avatar` components in `Contacts.tsx` to use `rounded-md` instead of `rounded-full`.
10. **Implement Momentum Components:** (Medium Impact / High Effort) Build the custom 1.5px gauge UI for contact touchpoint frequency to replace the generic number badges in `Contacts.tsx`.
