import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BudgetMatch = {
  speakerId: string;
  office: string;
  officeParent: string | null;
  via: "directory" | "agenda";
  lines: number;
  yourLines: { line: string; title: string | null; role: string | null; programs: string[] }[];
};

type SpeakerLike = { id: string; name: string; title: string | null; organization: string | null };

/**
 * Which speakers sit in an office tied to the budget lines on your Forecast programs, keyed by speaker id.
 * Empty when Forecast isn't connected for your company or doesn't answer.
 */
export function useBudgetMatches(conferenceId: string | undefined, speakers: SpeakerLike[]) {
  const { data } = useQuery({
    queryKey: ["forecast-budget-matches", conferenceId, speakers.length],
    enabled: !!conferenceId && speakers.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const body = { speakers: speakers.map(({ id, name, title, organization }) => ({ id, name, title, organization })) };
      const { data, error } = await supabase.functions.invoke("forecast-directory", { method: "POST", body });
      if (error) return [] as BudgetMatch[];
      return ((data as { matches?: BudgetMatch[] })?.matches ?? []) as BudgetMatch[];
    },
  });
  const bySpeaker = new Map<string, BudgetMatch>();
  for (const m of data ?? []) if (m.yourLines.length > 0) bySpeaker.set(m.speakerId, m);
  return bySpeaker;
}
