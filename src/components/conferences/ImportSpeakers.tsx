import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The function's own error message, also for non-2xx responses. */
async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch { /* fall through */ }
  }
  return error instanceof Error ? error.message : "Import failed";
}

/**
 * Paste a speakers, keynote or agenda page and add its named speakers to this
 * conference. Re-importing the same page replaces what it added before.
 */
export function ImportSpeakers({ conferenceId, className }: { conferenceId: string; className?: string }) {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (pageUrl: string) => {
      const { data, error } = await supabase.functions.invoke("ingest-conference-from-url", {
        body: { url: pageUrl, conference_id: conferenceId },
      });
      if (error) throw new Error(await functionError(error));
      if (!data?.success) throw new Error(data?.error || "Import failed");
      return data.conference.speaker_count as number;
    },
    onSuccess: (count) => {
      toast.success(`Added ${count} speaker${count === 1 ? "" : "s"}`);
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["conference-speakers", conferenceId] });
    },
    onError: (e) => toast.error("Couldn't import speakers", { description: e instanceof Error ? e.message : undefined }),
  });

  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !mutation.isPending) mutation.mutate(url.trim());
      }}
    >
      <Input
        type="url"
        inputMode="url"
        placeholder="Speakers or agenda page, e.g. https://www.iitsec.org/agenda/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Speakers page URL"
        className="text-sm"
      />
      <Button type="submit" variant="outline" disabled={!valid || mutation.isPending} className="shrink-0">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        {mutation.isPending ? "Reading page…" : "Import speakers"}
      </Button>
    </form>
  );
}
