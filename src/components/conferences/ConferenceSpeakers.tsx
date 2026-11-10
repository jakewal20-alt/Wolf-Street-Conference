import { useQuery } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImportSpeakers } from "./ImportSpeakers";

interface ConferenceSpeakersProps {
  conferenceId: string;
}

/**
 * Speakers extracted from the conference website by the URL import. Shown
 * so the team can plan who to meet; Forecast reads the same list to match
 * the program people it tracks.
 */
export function ConferenceSpeakers({ conferenceId }: ConferenceSpeakersProps) {
  const { data: speakers = [], isLoading } = useQuery({
    queryKey: ["conference-speakers", conferenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_speakers")
        .select("id, name, title, organization, session_title, session_time")
        .eq("conference_id", conferenceId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;

  if (speakers.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-border p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Speakers
        </div>
        <p className="mb-2 text-xs text-muted-foreground">Add the speaker list so Floor Mode can tell you who to meet.</p>
        <ImportSpeakers conferenceId={conferenceId} />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <Mic className="h-3.5 w-3.5" /> Speakers <span className="font-mono">({speakers.length})</span>
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {speakers.map((s) => (
          <li key={s.id} className="text-sm">
            <p className="font-medium text-foreground">{s.name}</p>
            {(s.title || s.organization) && (
              <p className="text-xs text-muted-foreground">
                {[s.title, s.organization].filter(Boolean).join(" · ")}
              </p>
            )}
            {(s.session_title || s.session_time) && (
              <p className="text-xs text-muted-foreground/80">
                {[s.session_title, s.session_time].filter(Boolean).join(" — ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Import more speakers from a page</summary>
        <ImportSpeakers conferenceId={conferenceId} className="mt-2" />
      </details>
    </div>
  );
}
