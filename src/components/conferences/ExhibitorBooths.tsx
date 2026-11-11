import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ImportExhibitors } from "@/components/conferences/ImportExhibitors";
import { useForecastPeople } from "@/components/conferences/ForecastPeople";
import { keysMatch, orgKeys } from "@/lib/personMatch";

type Exhibitor = { id: string; name: string; booth: string | null };
type SpeakerLike = { id: string; name: string; title: string | null; organization: string | null };
type LeadLike = { id: string; contact_name: string; company: string | null };
type ContactLike = { id: string; name: string; org_name: string | null; role: string | null };

type Reason = { kind: "incumbent" | "winner" | "service" | "pursuit" | "speaker" | "contact" | "met"; text: string };
const RANK: Record<Reason["kind"], number> = { incumbent: 0, winner: 1, service: 2, pursuit: 3, speaker: 4, contact: 5, met: 6 };
const LABEL: Record<Reason["kind"], string> = {
  incumbent: "Incumbent",
  winner: "Wins work",
  service: "Customer",
  pursuit: "Your pursuit",
  speaker: "Speaking here",
  contact: "You know",
  met: "Met here",
};
const PURSUIT_KINDS = new Set<Reason["kind"]>(["incumbent", "winner", "service", "pursuit"]);

type ForecastPursuit = { id: string; name: string; stage: string | null; program: string | null; service: string | null; url: string | null };
type ForecastCompany = { name: string; role: "incumbent" | "recipient"; detail: string | null; obligated: number | null; pursuit: ForecastPursuit };

// The service's own booths: "U.S. Army", "Army Modeling & Simulation Office", "Office of Naval
// Research", "USAF/USSF", "AFRL/RHW". Not associations that carry the name (AUSA).
const SERVICE_BOOTH: Record<string, RegExp> = {
  Army: /^(u\.?\s?s\.?\s+|us\s+|united states\s+)?army\b/i,
  Navy: /^(u\.?\s?s\.?\s+|us\s+|united states\s+)?(navy|naval)\b|^office of naval research\b|^(nawc|navair|navsea|navwar|nswc|nuwc|onr)\b/i,
  "Air Force": /^(u\.?\s?s\.?\s+|us\s+)?air force\b|^usaf\b|^(afrl|aflcmc|afams)\b|^(first|second|third|fourth|fifth|\d+(st|nd|rd|th)?)\s+air force\b/i,
};

function useForecastCompanies() {
  const { data } = useQuery({
    queryKey: ["forecast-companies"],
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("forecast-companies", { method: "GET" });
      if (error || !data?.available) return { pursuits: [] as ForecastPursuit[], companies: [] as ForecastCompany[] };
      return data as { pursuits: ForecastPursuit[]; companies: ForecastCompany[] };
    },
  });
  return data;
}

const MAX_TO_VISIT = 15;
const MAX_SEARCH = 30;

/** Booths grouped by company: "Akima" at 441 and MR2931 is one stop. */
function groupByCompany(rows: Exhibitor[]) {
  const map = new Map<string, { name: string; booths: string[] }>();
  for (const r of rows) {
    const key = r.name.toLowerCase();
    const g = map.get(key) ?? { name: r.name, booths: [] };
    if (r.booth && !g.booths.includes(r.booth)) g.booths.push(r.booth);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const boothText = (booths: string[]) => (booths.length ? `Booth ${booths.join(", ")}` : "No booth listed");

/**
 * Floor Mode's exhibitor section: booths worth a stop (incumbents and the
 * companies winning work on your Forecast pursuits' programs, the customer's own
 * service booths, people on your pursuits, speakers here, your contacts, people
 * you've met here),
 * a find-a-booth search, and the import when there's no list yet.
 */
export function ExhibitorBooths({
  conferenceId,
  speakers,
  leads,
  contacts,
}: {
  conferenceId: string;
  speakers: SpeakerLike[];
  leads: LeadLike[];
  contacts: ContactLike[];
}) {
  const [query, setQuery] = useState("");
  const forecastPeople = useForecastPeople();
  const forecast = useForecastCompanies();

  const { data: exhibitors = [], isError, isLoading } = useQuery({
    queryKey: ["conference-exhibitors", conferenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_exhibitors")
        .select("id,name,booth")
        .eq("conference_id", conferenceId)
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Exhibitor[];
    },
    retry: false,
  });

  const companies = useMemo(() => groupByCompany(exhibitors), [exhibitors]);

  const toVisit = useMemo(() => {
    // Every organization we know someone at, with why it matters.
    const sources: { keys: string[]; reason: Reason }[] = [];
    for (const c of forecast?.companies ?? []) {
      sources.push({
        keys: orgKeys(c.name),
        reason: c.role === "incumbent"
          ? { kind: "incumbent", text: `${c.pursuit.name}${c.detail ? ` · ${c.detail}` : ""}` }
          : { kind: "winner", text: `${c.pursuit.name}${c.detail ? ` · ${c.detail}` : ""}` },
      });
    }
    for (const p of forecastPeople) {
      if (!p.org || p.pursuits.length === 0) continue;
      const pursuits = Array.from(new Set(p.pursuits.map((x) => x.name))).join(", ");
      sources.push({ keys: orgKeys(p.org), reason: { kind: "pursuit", text: `${p.name}${p.title ? `, ${p.title}` : ""} · ${pursuits}` } });
    }
    for (const s of speakers) {
      if (s.organization) sources.push({ keys: orgKeys(s.organization), reason: { kind: "speaker", text: `${s.name}${s.title ? `, ${s.title}` : ""}` } });
    }
    for (const c of contacts) {
      if (c.org_name) sources.push({ keys: orgKeys(c.org_name), reason: { kind: "contact", text: `${c.name}${c.role ? `, ${c.role}` : ""}` } });
    }
    for (const l of leads) {
      if (l.company) sources.push({ keys: orgKeys(l.company), reason: { kind: "met", text: l.contact_name } });
    }
    // Your pursuits by service, for that service's own booths.
    const byService = new Map<string, ForecastPursuit[]>();
    for (const p of forecast?.pursuits ?? []) {
      if (p.service && SERVICE_BOOTH[p.service]) byService.set(p.service, [...(byService.get(p.service) ?? []), p]);
    }
    if (sources.length === 0 && byService.size === 0) return [];

    const hits: { name: string; booths: string[]; reasons: Reason[] }[] = [];
    for (const company of companies) {
      const keys = orgKeys(company.name);
      const reasons = sources
        .filter((src) => src.keys.some((a) => keys.some((b) => keysMatch(a, b))))
        .map((src) => src.reason);
      for (const [service, list] of byService) {
        if (SERVICE_BOOTH[service].test(company.name.trim())) {
          reasons.push({ kind: "service", text: `${service} booth · ${list.map((p) => p.name).join(", ")}` });
        }
      }
      // The same company can be named twice for one pursuit (incumbent and top recipient): keep one line each.
      const seen = new Set<string>();
      for (let i = reasons.length - 1; i >= 0; i--) {
        const key = `${reasons[i].kind}|${reasons[i].text}`;
        if (seen.has(key)) reasons.splice(i, 1);
        else seen.add(key);
      }
      if (reasons.length) {
        reasons.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
        hits.push({ ...company, reasons });
      }
    }
    return hits
      .sort((a, b) => RANK[a.reasons[0].kind] - RANK[b.reasons[0].kind] || b.reasons.length - a.reasons.length || a.name.localeCompare(b.name))
      .slice(0, MAX_TO_VISIT);
  }, [companies, forecast, forecastPeople, speakers, contacts, leads]);

  const q = query.trim().toLowerCase();
  const results = q ? companies.filter((c) => c.name.toLowerCase().includes(q) || c.booths.some((b) => b.toLowerCase() === q)) : [];

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Store className="h-4 w-4" /> Booths to visit
        {companies.length > 0 && <span className="font-normal">· {companies.length} exhibitors</span>}
      </h3>

      {isError ? (
        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">Exhibitor lists aren't set up yet.</p>
      ) : companies.length === 0 ? (
        <div className="space-y-2 rounded-xl border bg-card p-3 text-sm text-muted-foreground print:hidden">
          <p>No exhibitor list yet. Import the event's exhibitor directory to see which booths to visit:</p>
          <ImportExhibitors conferenceId={conferenceId} />
        </div>
      ) : (
        <>
          {toVisit.length > 0 ? (
            <ul className="divide-y rounded-xl border bg-card">
              {toVisit.map((c) => (
                <li key={c.name} className="p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="shrink-0 font-semibold text-primary">{boothText(c.booths)}</span>
                  </div>
                  {c.reasons.slice(0, 2).map((r, i) => (
                    <div key={i} className="line-clamp-2 text-muted-foreground">
                      <span className={PURSUIT_KINDS.has(r.kind) ? "font-semibold text-primary" : "font-medium text-foreground"}>{LABEL[r.kind]}:</span> {r.text}
                    </div>
                  ))}
                  {c.reasons.length > 2 && <div className="text-xs text-muted-foreground">+{c.reasons.length - 2} more</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
              None of the companies you're tracking or know people at are exhibiting. Search the list below.
            </p>
          )}

          <div className="space-y-2 rounded-xl border bg-card p-3 print:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a company or booth number"
                aria-label="Find a company or booth number"
                className="pl-8 text-sm"
              />
            </div>
            {q && (
              results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exhibitor matches "{query.trim()}".</p>
              ) : (
                <ul className="divide-y text-sm">
                  {results.slice(0, MAX_SEARCH).map((c) => (
                    <li key={c.name} className="flex items-baseline justify-between gap-2 py-1.5">
                      <span>{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{boothText(c.booths)}</span>
                    </li>
                  ))}
                  {results.length > MAX_SEARCH && <li className="py-1.5 text-xs text-muted-foreground">{results.length - MAX_SEARCH} more; keep typing</li>}
                </ul>
              )
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Import more exhibitors</summary>
              <ImportExhibitors conferenceId={conferenceId} className="mt-2" />
            </details>
          </div>
        </>
      )}
    </div>
  );
}
