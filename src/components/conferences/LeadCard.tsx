import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Mail, Phone, Building2, Sparkles, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { LeadDetailDialog } from "./LeadDetailDialog";
import { EditLeadDialog } from "./EditLeadDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LeadCardProps {
  lead: any;
  conferenceId: string;
}

export function LeadCard({ lead, conferenceId }: LeadCardProps) {
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("conference_leads")
        .delete()
        .eq("id", lead.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
    },
    onError: (error) => {
      toast.error("Failed to delete lead");
      console.error("Delete error:", error);
    },
  });

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">{lead.contact_name}</h4>
                {lead.source === "business_card" && (
                  <Badge variant="outline" className="text-xs">
                    Card
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {lead.company}
                {lead.title && ` • ${lead.title}`}
              </p>
            </div>
            {lead.ai_fit_score && lead.ai_fit_score >= 70 && (
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />
                {lead.ai_fit_score}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(lead.email || lead.phone) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {lead.email}
                </span>
              )}
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {lead.phone}
                </span>
              )}
            </div>
          )}

          {lead.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">{lead.notes}</p>
          )}

          {lead.ai_reason && (
            <div className="bg-muted/50 rounded-md p-2">
              <p className="text-xs text-muted-foreground">{lead.ai_reason}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetailDialog(true)}
            >
              <Eye className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <LeadDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        lead={lead}
      />
      <EditLeadDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        lead={lead}
        conferenceId={conferenceId}
      />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {lead.contact_name} from {lead.company}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
