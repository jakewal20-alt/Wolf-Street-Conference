import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeFormat } from "@/utils/dateHelpers";
import { cn } from "@/lib/utils";

type Pursuit = {
  id: string;
  name: string;
  stage: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  url: string | null;
};

/**
 * The Forecast pursuits this conference is linked to, so the person working
 * the floor knows which bids the people here matter for. Hidden when Forecast
 * isn't connected or nothing is linked.
 */
export function ForecastPursuits({ conferenceId, className }: { conferenceId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["forecast-pursuits", conferenceId],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `forecast-pursuits?conference_id=${encodeURIComponent(conferenceId)}`,
        { method: "GET" },
      );
      if (error) return { pursuits: [] as Pursuit[] };
      return data as { pursuits: Pursuit[] };
    },
  });

  const pursuits = data?.pursuits ?? [];
  if (pursuits.length === 0) return null;

  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Target className="h-4 w-4 text-primary" /> Linked Forecast pursuits
      </h3>
      <ul className="space-y-2">
        {pursuits.map((p) => (
          <li key={p.id} className="text-sm">
            <a
              href={p.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-2"
            >
              <span className="min-w-0">
                <span className="font-medium group-hover:underline">{p.name}</span>
                {p.stage && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{p.stage}</span>}
                {p.nextAction && (
                  <span className="block text-muted-foreground">
                    Next: {p.nextAction}
                    {p.nextActionDue ? ` · ${safeFormat(p.nextActionDue, "MMM d", p.nextActionDue)}` : ""}
                  </span>
                )}
              </span>
              {p.url && <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
