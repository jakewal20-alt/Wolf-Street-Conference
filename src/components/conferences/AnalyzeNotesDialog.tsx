import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface AnalyzeNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
}

export function AnalyzeNotesDialog({
  open,
  onOpenChange,
  conferenceId,
}: AnalyzeNotesDialogProps) {
  const [notes, setNotes] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    if (!notes.trim()) {
      toast.error("Please enter some notes to analyze");
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-conference-notes", {
        body: {
          conference_id: conferenceId,
          notes: notes.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Analyzed and scored ${data.leads_scored} leads`, {
          description: data.summary,
        });
        queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
        onOpenChange(false);
        setNotes("");
      } else {
        toast.error("Analysis failed");
      }
    } catch (error) {
      console.error("Error analyzing notes:", error);
      toast.error("Failed to analyze notes");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Analyze Conference Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste your conference notes, key themes, or conversation summaries. AI will analyze
            them against your BD persona and score your leads based on fit.
          </p>

          <div className="space-y-2">
            <Label htmlFor="notes">Conference Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste notes from the conference, key themes discussed, interesting conversations, technology trends, etc..."
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAnalyzing}
            >
              Cancel
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze & Score Leads
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}