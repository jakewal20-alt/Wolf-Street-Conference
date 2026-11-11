import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [pageText, setPageText] = useState("");
  // Some sites refuse server fetches; then the user pastes the page's text.
  const [pasteMode, setPasteMode] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ pageUrl, text }: { pageUrl: string; text?: string }) => {
      const { data, error } = await supabase.functions.invoke("ingest-conference-from-url", {
        body: { url: pageUrl, conference_id: conferenceId, ...(text ? { page_text: text } : {}) },
      });
      if (error) throw new Error(await functionError(error));
      if (!data?.success) throw new Error(data?.error || "Import failed");
      return data.conference.speaker_count as number;
    },
    onSuccess: (count) => {
      toast.success(`Added ${count} speaker${count === 1 ? "" : "s"}`);
      setUrl("");
      setPageText("");
      setPasteMode(false);
      queryClient.invalidateQueries({ queryKey: ["conference-speakers", conferenceId] });
    },
    onError: (e, vars) => {
      if (!vars.text) setPasteMode(true);
      toast.error("Couldn't import speakers", {
        description: `${e instanceof Error ? e.message : ""}${vars.text ? "" : " You can paste the page's text instead."}`.trim(),
        duration: 10_000,
      });
    },
  });

  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());
  const canSubmit = valid && (!pasteMode || pageText.trim().length > 20);

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !mutation.isPending) mutation.mutate({ pageUrl: url.trim(), text: pasteMode ? pageText : undefined });
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Input
        type="url"
        inputMode="url"
        placeholder="Speakers or agenda page, e.g. https://www.iitsec.org/agenda/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Speakers page URL"
        className="text-sm"
      />
      {pasteMode && (
        <>
          <p className="text-xs text-muted-foreground">
            That site wouldn't let Hallway read it. Open the page, select all (⌘A / Ctrl+A), copy, and paste it here:
          </p>
          <Textarea
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            placeholder="Paste the speakers page text"
            aria-label="Speakers page text"
            rows={5}
            className="text-sm"
          />
        </>
      )}
      {!pasteMode && (
        <button type="button" className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setPasteMode(true)}>
          Or paste the page's text
        </button>
      )}
      </div>
      <Button type="submit" variant="outline" disabled={!canSubmit || mutation.isPending} className="shrink-0 sm:self-start">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        {mutation.isPending ? "Reading page (up to a minute)…" : "Import speakers"}
      </Button>
    </form>
  );
}
