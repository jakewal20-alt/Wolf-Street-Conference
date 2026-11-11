import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The function's own error message, also for non-2xx responses. */
async function functionError(error: unknown): Promise<{ message: string; needsPaste: boolean }> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return { message: String(body.error), needsPaste: body.needs_paste === true };
    } catch { /* fall through */ }
  }
  return { message: error instanceof Error ? error.message : "Import failed", needsPaste: false };
}

class ImportError extends Error {
  constructor(message: string, readonly needsPaste: boolean) {
    super(message);
  }
}

/**
 * Add a conference's exhibitors (company + booth) from its exhibitor
 * directory: the URL, or the page's text pasted in. Only new booths are
 * added, so a directory that pages by script can be pasted one page at a time.
 */
export function ImportExhibitors({ conferenceId, className }: { conferenceId: string; className?: string }) {
  const [url, setUrl] = useState("");
  const [pageText, setPageText] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ pageUrl, text }: { pageUrl: string; text?: string }) => {
      const { data, error } = await supabase.functions.invoke("import-exhibitors", {
        body: { conference_id: conferenceId, url: pageUrl, ...(text ? { page_text: text } : {}) },
      });
      if (error) {
        const { message, needsPaste } = await functionError(error);
        throw new ImportError(message, needsPaste);
      }
      if (!data?.success) throw new ImportError(data?.error || "Import failed", data?.needs_paste === true);
      return data as { added: number; found: number; total: number };
    },
    onSuccess: ({ added, found, total }) => {
      toast.success(
        added > 0 ? `Added ${added} booth${added === 1 ? "" : "s"} · ${total} exhibitors in all` : `All ${found} were already here · ${total} exhibitors`,
        { description: pasteMode ? "Paste the next page of the list to add more." : undefined },
      );
      // Keep the URL and paste box open: long directories come one page at a time.
      setPageText("");
      queryClient.invalidateQueries({ queryKey: ["conference-exhibitors", conferenceId] });
    },
    onError: (e) => {
      if (e instanceof ImportError && e.needsPaste) setPasteMode(true);
      toast.error("Couldn't import exhibitors", { description: e instanceof Error ? e.message : undefined, duration: 10_000 });
    },
  });

  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());
  const hasText = pageText.trim().length > 20;
  const canSubmit = pasteMode ? hasText : valid;

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !mutation.isPending) {
          mutation.mutate({ pageUrl: url.trim(), text: pasteMode ? pageText : undefined });
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input
          type="url"
          inputMode="url"
          placeholder="Exhibitor directory, e.g. https://…/exhibitors"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Exhibitor directory URL"
          className="text-sm"
        />
        {pasteMode ? (
          <>
            <p className="text-xs text-muted-foreground">
              Open the exhibitor list, select all (⌘A / Ctrl+A), copy, and paste it here. For a list split into pages, paste each page in turn.
            </p>
            <Textarea
              value={pageText}
              onChange={(e) => setPageText(e.target.value)}
              placeholder="Paste the exhibitor list (names with booth numbers)"
              aria-label="Exhibitor list text"
              rows={5}
              className="text-sm"
            />
          </>
        ) : (
          <button type="button" className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setPasteMode(true)}>
            Or paste the list's text
          </button>
        )}
      </div>
      <Button type="submit" variant="outline" disabled={!canSubmit || mutation.isPending} className="shrink-0 sm:self-start">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
        {mutation.isPending ? "Reading…" : "Import exhibitors"}
      </Button>
    </form>
  );
}
