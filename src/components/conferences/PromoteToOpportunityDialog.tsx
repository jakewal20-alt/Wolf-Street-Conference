import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface PromoteToOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  conferenceId: string;
}

export function PromoteToOpportunityDialog({
  open,
  onOpenChange,
  lead,
  conferenceId,
}: PromoteToOpportunityDialogProps) {
  const [title, setTitle] = useState(
    `${lead.contact_name} at ${lead.company}`
  );
  const [description, setDescription] = useState(
    lead.notes || `Lead from conference: ${lead.company}`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get conference name for reference
      const { data: conference } = await supabase
        .from("conferences")
        .select("name")
        .eq("id", conferenceId)
        .single();

      // Create opportunity
      const opportunityNumber = `CONF-${Date.now()}`;
      const { data: opportunity, error: oppError } = await supabase
        .from("opportunities")
        .insert({
          opportunity_number: opportunityNumber,
          title,
          description,
          source: "Conference",
          notes: `Origin: ${conference?.name || "Conference"}\nContact: ${lead.contact_name}\nCompany: ${lead.company}\n\nOriginal lead notes:\n${lead.notes || "No additional notes"}`,
          is_user_pursuit: true,
          status: "Early BD",
          user_id: user.id,
        })
        .select()
        .single();

      if (oppError) throw oppError;

      // Update lead status and link to opportunity
      const { error: leadError } = await supabase
        .from("conference_leads")
        .update({
          status: "converted",
          linked_opportunity_id: opportunity.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      if (leadError) throw leadError;

      toast.success("Lead promoted to opportunity and added to Dashboard", {
        action: {
          label: "View in Dashboard",
          onClick: () => navigate("/"),
        },
      });

      queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error promoting lead:", error);
      toast.error("Failed to promote lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Promote to Opportunity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium">{lead.contact_name}</p>
            <p className="text-muted-foreground">{lead.company}</p>
            {lead.title && <p className="text-muted-foreground text-xs mt-1">{lead.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Opportunity Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            This will create a new opportunity on your Dashboard and mark this lead as converted.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Promote to Opportunity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}