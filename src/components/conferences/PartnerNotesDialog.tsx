import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Loader2 } from "lucide-react";

interface PartnerNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
}

export function PartnerNotesDialog({
  open,
  onOpenChange,
  conferenceId,
}: PartnerNotesDialogProps) {
  const [notes, setNotes] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    if (!notes.trim()) {
      toast.error("Please enter partner notes to analyze");
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-partner-notes", {
        body: {
          conference_id: conferenceId,
          notes: notes.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        const messages = [];
        if (data.leads_added > 0) {
          messages.push(`Added ${data.leads_added} new leads`);
        }
        if (data.leads_updated > 0) {
          messages.push(`Updated ${data.leads_updated} existing leads`);
        }
        if (messages.length === 0) {
          messages.push("Notes analyzed and stored");
        }
        
        toast.success(messages.join(", "), {
          description: "Partner insights will be included in executive summary",
        });
        
        queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
        queryClient.invalidateQueries({ queryKey: ["conference", conferenceId] });
        onOpenChange(false);
        setNotes("");
      } else {
        toast.error("Analysis failed", { description: data.error });
      }
    } catch (error) {
      console.error("Error analyzing partner notes:", error);
      toast.error("Failed to analyze partner notes");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Partner Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste notes from your BD partner's observations at the event. AI will extract 
            new leads, update existing ones with additional context, and incorporate insights 
            into your executive summary.
          </p>

          <div className="space-y-2">
            <Label htmlFor="partner-notes">Partner's Notes</Label>
            <Textarea
              id="partner-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your partner's notes here... Include any contacts they met, conversations had, key insights about companies, potential opportunities, etc."
              rows={12}
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
                  <Users className="w-4 h-4 mr-2" />
                  Analyze & Extract Leads
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
