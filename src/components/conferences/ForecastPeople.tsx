import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Mic2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { indexByName, nameKey } from "@/lib/personMatch";

export type ForecastPerson = {
  id: string;
  name: string;
  title: string | null;
  org: string | null;
  role: string | null;
  pursuits: { name: string; stage: string | null; linked: boolean }[];
  programs: string[];
  url: string | null;
};

type SpeakerLike = { id: string; name: string; title: string | null; organization: string | null; session_title: string | null; session_time: string | null };
type LeadLike = { id: string; contact_name: string; company: string | null };

const MAX_LOOK_FOR = 8;

/**
 * People Forecast tracks on your pursuits, matched against this conference:
 * who is speaking here, who you've already met here, and who to look for.
 * Hidden when Forecast isn't connected or tracks nobody.
 */
export function ForecastPeople({ speakers, leads }: { speakers: SpeakerLike[]; leads: LeadLike[] }) {
  const { data } = useQuery({
    queryKey: ["forecast-people"],
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("forecast-people", { method: "GET" });
      if (error) return { people: [] as ForecastPerson[] };
      return data as { people: ForecastPerson[] };
    },
  });

  const people = data?.people ?? [];
  if (people.length === 0) return null;

  const speakerByName = indexByName(speakers, (s) => s.name);
  const leadByName = indexByName(leads, (l) => l.contact_name);

  const speaking: { person: ForecastPerson; speaker: SpeakerLike }[] = [];
  const met: { person: ForecastPerson; lead: LeadLike }[] = [];
  const lookFor: ForecastPerson[] = [];
  for (const person of people) {
    const key = nameKey(person.name);
    const lead = key ? leadByName.get(key) : undefined;
    const speaker = key ? speakerByName.get(key) : undefined;
    if (lead) met.push({ person, lead });
    else if (speaker) speaking.push({ person, speaker });
    else if (person.pursuits.length > 0) lookFor.push(person);
  }
  if (speaking.length === 0 && met.length === 0 && lookFor.length === 0) return null;

  const pursuitLine = (p: ForecastPerson) => {
    const names = Array.from(new Set(p.pursuits.map((x) => x.name)));
    return names.length ? `For ${names.join(", ")}` : p.programs.length ? `On ${p.programs.join(", ")}` : null;
  };
  const who = (p: ForecastPerson) => [p.title, p.org].filter(Boolean).join(", ");

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Target className="h-4 w-4" /> People from your Forecast pursuits
      </h3>
      <ul className="divide-y rounded-xl border bg-card">
        {speaking.map(({ person, speaker }) => (
          <li key={`s-${person.id}`} className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{speaker.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Mic2 className="h-3 w-3" /> Speaking here
              </span>
            </div>
            <div className="text-muted-foreground">{[speaker.title, speaker.organization].filter(Boolean).join(", ") || who(person)}</div>
            {(speaker.session_title || speaker.session_time) && (
              <div className="mt-0.5 text-xs">{[speaker.session_time, speaker.session_title].filter(Boolean).join(" · ")}</div>
            )}
            {pursuitLine(person) && <div className="mt-0.5 text-xs text-primary">{pursuitLine(person)}</div>}
          </li>
        ))}
        {lookFor.slice(0, MAX_LOOK_FOR).map((person) => (
          <li key={`l-${person.id}`} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{person.name}</span>
              {person.url && (
                <a href={person.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground print:hidden" aria-label={`Open ${person.name}'s program in Forecast`}>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
            {who(person) && <div className="text-muted-foreground">{who(person)}</div>}
            {pursuitLine(person) && <div className="mt-0.5 text-xs text-primary">{pursuitLine(person)}</div>}
          </li>
        ))}
        {met.map(({ person, lead }) => (
          <li key={`m-${person.id}`} className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              <span className="font-medium text-foreground">{lead.contact_name}</span> · met here
              {pursuitLine(person) ? ` · ${pursuitLine(person)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {speakers.length === 0 && lookFor.length > 0 && (
        <p className="text-xs text-muted-foreground">Import the speaker list to see which of them are speaking here.</p>
      )}
    </div>
  );
}
