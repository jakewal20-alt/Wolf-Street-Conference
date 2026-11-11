import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { format, startOfDay } from "date-fns";
import { Building2, Clock3, Landmark, Mic2, Printer, ScanLine, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadBusinessCardDialog } from "@/components/conferences/UploadBusinessCardDialog";
import { VoiceRecapDialog } from "@/components/conferences/VoiceRecapDialog";
import { ForecastPursuits } from "@/components/conferences/ForecastPursuits";
import { ForecastPeople } from "@/components/conferences/ForecastPeople";
import { ImportSpeakers } from "@/components/conferences/ImportSpeakers";
import { ExhibitorBooths } from "@/components/conferences/ExhibitorBooths";
import { useBudgetMatches } from "@/components/conferences/useBudgetMatches";
import { safeFormat, tryParseDate } from "@/utils/dateHelpers";
import { cn } from "@/lib/utils";

type Conference = { id: string; name: string; start_date: string; end_date: string | null; location: string | null };
type Speaker = { id: string; name: string; title: string | null; organization: string | null; session_title: string | null; session_time: string | null };
type Lead = {
  id: string;
  contact_name: string;
  company: string | null;
  title: string | null;
  status: string | null;
  created_at: string;
  next_follow_up_date: string | null;
  next_follow_up_note: string | null;
};
type Contact = { id: string; name: string; org_name: string | null; role: string | null };

// Government buyers and program people are who BD teams most want to meet.
const GOVERNMENT_ORG =
  /\b(army|navy|air force|space force|marine|coast guard|dod|department of|pentagon|peo\b|pm\b|command|usd\(|osd|disa|darpa|diu|dla|dtra|nga|nro|nsa|socom|ussocom|afrl|onr|navair|navsea|navwar|cecom|devcom|atec|jpeo|jsf|national guard|joint staff|office of|agency|government|u\.s\.|us )/i;

const normOrg = (org: string | null | undefined) =>
  (org ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|llc|corp|corporation|company|co|the|ltd)\b/g, " ").replace(/\s+/g, " ").trim();

/** Conference on today, else the next one coming up. */
function pickConference(conferences: Conference[]): Conference | undefined {
  const today = startOfDay(new Date());
  const live = conferences.find((c) => {
    const s = tryParseDate(c.start_date);
    const e = tryParseDate(c.end_date) ?? s;
    return s && e && startOfDay(s) <= today && today <= startOfDay(e);
  });
  return live ?? conferences[0];
}

function dateRange(c: Conference) {
  const s = safeFormat(c.start_date, "MMM d", c.start_date);
  const e = c.end_date ? safeFormat(c.end_date, "MMM d, yyyy", c.end_date) : "";
  return e ? `${s} – ${e}` : s;
}

/**
 * Show Floor Mode: a phone-first screen for working a conference. Two big
 * buttons (scan a card, record a voice recap) for the current conference,
 * what was captured today, and a "who to meet" hit list from the speaker
 * list, the people already met there, your contacts at speakers' orgs, and
 * the exhibitor booths tied to people you track or know.
 */
export default function Floor() {
  const [params, setParams] = useSearchParams();
  const [scanOpen, setScanOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);

  const { data: conferences = [], isLoading: loadingConferences } = useQuery({
    queryKey: ["floor-conferences"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("conferences")
        .select("id,name,start_date,end_date,location")
        .eq("archived", false)
        .gte("end_date", today)
        .order("start_date")
        .limit(12);
      if (error) throw error;
      return ((data ?? []) as Conference[]).filter((c) => tryParseDate(c.start_date));
    },
  });

  const selectedId = params.get("conference");
  const conference = useMemo(
    () => conferences.find((c) => c.id === selectedId) ?? pickConference(conferences),
    [conferences, selectedId],
  );

  useEffect(() => {
    document.title = conference ? `Floor Mode · ${conference.name}` : "Floor Mode · Hallway";
  }, [conference]);

  const { data: leads = [] } = useQuery({
    queryKey: ["conference-leads", conference?.id],
    enabled: !!conference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_leads")
        .select("*")
        .eq("conference_id", conference!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const { data: speakers = [], isError: speakersFailed } = useQuery({
    queryKey: ["conference-speakers", conference?.id],
    enabled: !!conference,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_speakers")
        .select("id,name,title,organization,session_title,session_time")
        .eq("conference_id", conference!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Speaker[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["floor-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name,org_name,role").not("org_name", "is", null).limit(1000);
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const capturedToday = leads.filter((l) => l.created_at?.slice(0, 10) === today);
  const metNames = new Set(leads.map((l) => l.contact_name.trim().toLowerCase()));

  // Speakers in an office tied to the budget lines on your Forecast programs.
  const budgetMatches = useBudgetMatches(conference?.id, speakers);

  // Speakers you haven't met yet: those tied to your budget lines first, then government.
  const targets = speakers
    .filter((s) => !metNames.has(s.name.trim().toLowerCase()))
    .map((s) => ({ ...s, government: GOVERNMENT_ORG.test(`${s.organization ?? ""} ${s.title ?? ""}`), budget: budgetMatches.get(s.id) }))
    .sort((a, b) => Number(!!b.budget) - Number(!!a.budget) || Number(b.government) - Number(a.government) || a.name.localeCompare(b.name));

  // Your contacts who work where a speaker works: an easy introduction.
  const speakerOrgs = new Map<string, string>();
  for (const s of speakers) {
    const key = normOrg(s.organization);
    if (key.length >= 3) speakerOrgs.set(key, s.organization!);
  }
  const insiders = contacts
    .filter((c) => speakerOrgs.has(normOrg(c.org_name)))
    .slice(0, 12);

  // People already met here with a follow-up still open.
  const followUps = leads
    .filter((l) => l.next_follow_up_date && !["converted", "dropped"].includes(l.status ?? ""))
    .sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""))
    .slice(0, 10);

  if (loadingConferences) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!conference) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Floor Mode</h1>
        <p className="text-muted-foreground">No upcoming conference. Add one first, then come back here on the show floor.</p>
        <Button asChild><Link to="/conferences">Go to Conferences</Link></Button>
      </div>
    );
  }

  return (
    <div className="floor-mode mx-auto w-full max-w-xl space-y-6 p-4 pb-16 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Floor Mode</p>
        {conferences.length > 1 ? (
          <Select value={conference.id} onValueChange={(id) => setParams({ conference: id }, { replace: true })}>
            <SelectTrigger className="h-auto py-2 font-display text-xl font-semibold print:hidden" aria-label="Conference">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conferences.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <h1 className={cn("font-display text-2xl font-semibold", conferences.length > 1 && "hidden print:block")}>{conference.name}</h1>
        <p className="text-sm text-muted-foreground">
          {dateRange(conference)}{conference.location ? ` · ${conference.location}` : ""}
        </p>
      </header>

      {/* The two things you do on the floor */}
      <section className="grid grid-cols-1 gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="flex min-h-[112px] items-center gap-4 rounded-2xl bg-primary px-6 text-left text-primary-foreground shadow-sm transition active:scale-[0.99]"
        >
          <ScanLine className="h-10 w-10 shrink-0" />
          <span>
            <span className="block text-xl font-semibold">Scan a card or badge</span>
            <span className="block text-sm opacity-80">Take a photo; name, title, email and phone fill in</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          className="flex min-h-[112px] items-center gap-4 rounded-2xl border-2 border-primary bg-card px-6 text-left text-foreground shadow-sm transition active:scale-[0.99]"
        >
          <Mic2 className="h-10 w-10 shrink-0 text-primary" />
          <span>
            <span className="block text-xl font-semibold">Record a voice recap</span>
            <span className="block text-sm text-muted-foreground">Say who you met and what they care about</span>
          </span>
        </button>
      </section>

      <section className="rounded-xl border bg-card p-4 print:hidden">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Captured today</h2>
          <span className="text-2xl font-bold text-primary">{capturedToday.length}</span>
        </div>
        {capturedToday.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {capturedToday.slice(0, 5).map((l) => (
              <li key={l.id} className="truncate">
                <span className="font-medium">{l.contact_name}</span>
                {l.company ? <span className="text-muted-foreground"> · {l.company}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nothing yet today. {leads.length} people captured at this conference so far.</p>
        )}
        <Link to={`/conferences?selected=${conference.id}`} className="mt-3 inline-block text-sm font-medium text-primary">
          All leads for this conference →
        </Link>
      </section>

      <ForecastPursuits conferenceId={conference.id} />

      {/* Hit list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Who to meet</h2>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
        </div>

        {followUps.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Clock3 className="h-4 w-4" /> Already met: follow up</h3>
            <ul className="divide-y rounded-xl border bg-card">
              {followUps.map((l) => (
                <li key={l.id} className="p-3 text-sm">
                  <div className="font-medium">{l.contact_name}{l.company ? <span className="font-normal text-muted-foreground"> · {l.company}</span> : null}</div>
                  <div className="text-muted-foreground">
                    {safeFormat(l.next_follow_up_date, "EEE, MMM d", l.next_follow_up_date ?? "")}
                    {l.next_follow_up_note ? ` · ${l.next_follow_up_note}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ForecastPeople speakers={speakers} leads={leads} />

        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Users className="h-4 w-4" /> Speakers you haven't met</h3>
          {speakersFailed ? (
            <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">Couldn't load the speaker list.</p>
          ) : targets.length === 0 ? (
            speakers.length === 0 ? (
              <div className="space-y-2 rounded-xl border bg-card p-3 text-sm text-muted-foreground print:hidden">
                <p>No speaker list for this conference yet. Paste the event's speakers, keynote or agenda page:</p>
                <ImportSpeakers conferenceId={conference.id} />
              </div>
            ) : (
              <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">You've met every listed speaker.</p>
            )
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {targets.map((s) => (
                <li key={s.id} className="p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.budget ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        <Landmark className="h-3 w-3" /> Your budget line
                      </span>
                    ) : s.government && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Government</span>
                    )}
                  </div>
                  <div className="text-muted-foreground">{[s.title, s.organization].filter(Boolean).join(", ")}</div>
                  {s.budget && (
                    <div className="mt-0.5 text-xs text-primary">
                      {s.budget.office}{s.budget.officeParent ? ` (under ${s.budget.officeParent})` : ""} ·{" "}
                      {s.budget.yourLines.map((l) => [l.line, l.programs.length ? `for ${l.programs.join(", ")}` : null].filter(Boolean).join(" ")).join("; ")}
                    </div>
                  )}
                  {(s.session_title || s.session_time) && (
                    <div className="mt-0.5 text-xs">{[s.session_time, s.session_title].filter(Boolean).join(" · ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ExhibitorBooths conferenceId={conference.id} speakers={speakers} leads={leads} contacts={contacts} />

        {insiders.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Building2 className="h-4 w-4" /> You know someone at a speaker's organization</h3>
            <ul className="divide-y rounded-xl border bg-card">
              {insiders.map((c) => (
                <li key={c.id} className="flex items-center gap-2 p-3 text-sm">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{c.name}</span>
                  <span className="truncate text-muted-foreground">{[c.role, c.org_name].filter(Boolean).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <UploadBusinessCardDialog open={scanOpen} onOpenChange={setScanOpen} conferenceId={conference.id} />
      <VoiceRecapDialog open={recapOpen} onOpenChange={setRecapOpen} conferenceId={conference.id} leads={leads} />
    </div>
  );
}
