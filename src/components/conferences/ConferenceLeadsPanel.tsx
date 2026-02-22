import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Link2, ExternalLink, Users, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeadCard } from "./LeadCard";
import { AddLeadDialog } from "./AddLeadDialog";
import { UploadBusinessCardDialog } from "./UploadBusinessCardDialog";
import { AnalyzeNotesDialog } from "./AnalyzeNotesDialog";
import { PartnerNotesDialog } from "./PartnerNotesDialog";
import { LinkCalendarEventDialog } from "./LinkCalendarEventDialog";
import { ShareConferenceDialog } from "./ShareConferenceDialog";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { useNavigate } from "react-router-dom";

interface ConferenceLeadsPanelProps {
  conference: any;
}

export function ConferenceLeadsPanel({ conference }: ConferenceLeadsPanelProps) {
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [showUploadCardDialog, setShowUploadCardDialog] = useState(false);
  const [showAnalyzeNotesDialog, setShowAnalyzeNotesDialog] = useState(false);
  const [showPartnerNotesDialog, setShowPartnerNotesDialog] = useState(false);
  const [showLinkCalendarDialog, setShowLinkCalendarDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const navigate = useNavigate();

  // Check if current user is the owner
  const { data: isOwner } = useQuery({
    queryKey: ["conference-is-owner", conference.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id === conference.created_by;
    },
  });

  // Fetch collaborator count
  const { data: collaboratorCount } = useQuery({
    queryKey: ["conference-collaborator-count", conference.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("conference_collaborators")
        .select("*", { count: "exact", head: true })
        .eq("conference_id", conference.id);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["conference-leads", conference.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("conference_leads")
        .select("*")
        .eq("conference_id", conference.id)
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const groupedLeads = {
    new: leads?.filter(l => l.status === "new") || [],
    contacted: leads?.filter(l => l.status === "contacted") || [],
    qualified: leads?.filter(l => l.status === "qualified") || [],
    converted: leads?.filter(l => l.status === "converted") || [],
    dropped: leads?.filter(l => l.status === "dropped") || [],
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <CardTitle className="text-lg sm:text-xl">Leads for {conference.name}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Manage contacts and business cards from this conference
              </CardDescription>
              {conference.calendar_event_id && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    <Link2 className="w-3 h-3 mr-1" />
                    Linked to calendar
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/calendar")}
                    className="h-6 px-2 text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View in Calendar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!conference.calendar_event_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkCalendarDialog(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Link to Calendar</span>
                  <span className="sm:hidden">Link</span>
                </Button>
              )}
              {isOwner && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowShareDialog(true)}
                  className="flex-1 sm:flex-none"
                >
                  <UserPlus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Share</span>
                  {collaboratorCount && collaboratorCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {collaboratorCount}
                    </Badge>
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAnalyzeNotesDialog(true)}
                className="flex-1 sm:flex-none"
              >
                <span className="hidden sm:inline">Analyze Notes</span>
                <span className="sm:hidden">Analyze</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPartnerNotesDialog(true)}
                className="flex-1 sm:flex-none"
              >
                <Users className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Partner Notes</span>
                <span className="sm:hidden">Partner</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddLeadDialog(true)}
                className="flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Lead</span>
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowUploadCardDialog(true)}
                className="flex-1 sm:flex-none"
              >
                <Upload className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Business Card</span>
                <span className="sm:hidden">Card</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading leads...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {["new", "contacted", "qualified", "converted", "dropped"].map((status) => {
            const statusLeads = groupedLeads[status as keyof typeof groupedLeads];
            const statusLabels: Record<string, string> = {
              new: "New",
              contacted: "Contacted",
              qualified: "Qualified",
              converted: "Converted",
              dropped: "Dropped",
            };

            return (
              <div key={status}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {statusLabels[status]} ({statusLeads.length})
                </h3>
                <div className="grid gap-3">
                  {statusLeads.length > 0 ? (
                    statusLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} conferenceId={conference.id} />
                    ))
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center text-sm text-muted-foreground">
                        No {statusLabels[status].toLowerCase()} leads
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Executive Summary Section */}
      <ExecutiveSummary conference={conference} />

      <AddLeadDialog
        open={showAddLeadDialog}
        onOpenChange={setShowAddLeadDialog}
        conferenceId={conference.id}
      />
      <UploadBusinessCardDialog
        open={showUploadCardDialog}
        onOpenChange={setShowUploadCardDialog}
        conferenceId={conference.id}
      />
      <AnalyzeNotesDialog
        open={showAnalyzeNotesDialog}
        onOpenChange={setShowAnalyzeNotesDialog}
        conferenceId={conference.id}
      />
      <PartnerNotesDialog
        open={showPartnerNotesDialog}
        onOpenChange={setShowPartnerNotesDialog}
        conferenceId={conference.id}
      />
      <LinkCalendarEventDialog
        open={showLinkCalendarDialog}
        onOpenChange={setShowLinkCalendarDialog}
        conferenceId={conference.id}
        conferenceName={conference.name}
      />
      <ShareConferenceDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        conferenceId={conference.id}
        conferenceName={conference.name}
      />
    </div>
  );
}