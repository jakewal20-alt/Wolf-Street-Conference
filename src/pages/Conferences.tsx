import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Users, Download, ExternalLink, CalendarDays, Trash2, Mail, Loader2, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { format, isToday, isFuture, isWithinInterval } from "date-fns";
import { parseDateLocal } from "@/utils/dateHelpers";
import { AddConferenceDialog } from "@/components/conferences/AddConferenceDialog";
import { ConferenceLeadsPanel } from "@/components/conferences/ConferenceLeadsPanel";
import { ImportCalendarEventsDialog } from "@/components/conferences/ImportCalendarEventsDialog";
import { IngestFromUrlDialog } from "@/components/conferences/IngestFromUrlDialog";
import { EditConferenceDialog } from "@/components/conferences/EditConferenceDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout, PageHeader } from "@/components/PageLayout";

export default function Conferences() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showIngestDialog, setShowIngestDialog] = useState(false);
  const [conferenceToDelete, setConferenceToDelete] = useState<string | null>(null);
  const [conferenceToEdit, setConferenceToEdit] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const archiveConferenceMutation = useMutation({
    mutationFn: async ({ conferenceId, archived }: { conferenceId: string; archived: boolean }) => {
      const { error } = await supabase
        .from("conferences")
        .update({ archived })
        .eq("id", conferenceId);
      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      toast.success(archived ? "Conference archived" : "Conference restored");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    },
    onError: (error) => {
      console.error("Archive error:", error);
      toast.error("Failed to update conference");
    },
  });

  const deleteConferenceMutation = useMutation({
    mutationFn: async (conferenceId: string) => {
      // First delete all leads for this conference
      const { error: leadsError } = await supabase
        .from("conference_leads")
        .delete()
        .eq("conference_id", conferenceId);
      if (leadsError) throw leadsError;

      // Then delete the conference
      const { error } = await supabase
        .from("conferences")
        .delete()
        .eq("id", conferenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conference deleted");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      if (selectedConferenceId === conferenceToDelete) {
        setSelectedConferenceId(null);
      }
      setConferenceToDelete(null);
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete conference");
    },
  });

  // Calendar invite-by-email flow removed in favor of in-app collaboration

  // Handle URL parameter for selected conference (for deep linking from calendar)
  useEffect(() => {
    const selectedParam = searchParams.get('selected');
    if (selectedParam) {
      setSelectedConferenceId(selectedParam);
    }
  }, [searchParams]);

  const { data: conferences, isLoading } = useQuery({
    queryKey: ["conferences"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Conferences you own
      const { data: owned, error: ownedError } = await supabase
        .from("conferences")
        .select(`*, conference_leads(count)`)
        .eq("created_by", user.id)
        .order("start_date", { ascending: true });
      if (ownedError) throw ownedError;

      // Conferences where you are a collaborator
      const { data: collabs, error: collabError } = await supabase
        .from("conference_collaborators")
        .select("conference_id")
        .eq("user_id", user.id);
      if (collabError) throw collabError;

      const collaboratedIds = (collabs || []).map((c) => c.conference_id).filter(Boolean);
      const { data: collaborated, error: collaboratedError } = collaboratedIds.length
        ? await supabase
            .from("conferences")
            .select(`*, conference_leads(count)`)
            .in("id", collaboratedIds)
            .order("start_date", { ascending: true })
        : { data: [], error: null };
      if (collaboratedError) throw collaboratedError;

      // Merge + de-dupe
      const merged = [...(owned || []), ...(collaborated || [])];
      const byId = new Map<string, any>();
      for (const conf of merged) byId.set(conf.id, conf);
      const data = Array.from(byId.values());

      // Enrich with owner info for shared conferences
      const ownerIds = Array.from(new Set(data.map((c) => c.created_by).filter((id) => id && id !== user.id)));
      const { data: profiles, error: profilesError } = ownerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const ownerNameById = new Map<string, string>();
      (profiles || []).forEach((p: any) => ownerNameById.set(p.id, p.full_name || p.email || "Unknown"));
      
      // Add owner info and sort: upcoming first (by date asc), then past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const enriched = data?.map(conf => ({
        ...conf,
        is_shared: conf.created_by !== user.id,
        owner_name: conf.created_by !== user.id 
          ? ownerNameById.get(conf.created_by) || null
          : null
      })) || [];
      
      // Sort: upcoming/in-progress first (by start_date asc), then past (by start_date desc)
      return enriched.sort((a, b) => {
        const aStart = parseDateLocal(a.start_date);
        const bStart = parseDateLocal(b.start_date);
        const aEnd = parseDateLocal(a.end_date);
        const bEnd = parseDateLocal(b.end_date);
        
        const aIsPast = aEnd < today;
        const bIsPast = bEnd < today;
        
        // Upcoming/in-progress conferences come first
        if (!aIsPast && bIsPast) return -1;
        if (aIsPast && !bIsPast) return 1;
        
        // For upcoming: sort by start date ascending (soonest first)
        if (!aIsPast && !bIsPast) {
          return aStart.getTime() - bStart.getTime();
        }
        
        // For past: sort by start date descending (most recent first)
        return bStart.getTime() - aStart.getTime();
      });
    },
  });

  const getConferenceStatus = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isWithinInterval(now, { start, end })) {
      return { 
        label: "In Progress", 
        variant: "default" as const,
        isPast: false,
        isActive: true,
        className: "bg-success text-success-foreground border-success"
      };
    }
    if (isFuture(start)) {
      return { 
        label: "Upcoming", 
        variant: "secondary" as const,
        isPast: false,
        isActive: false,
        className: "bg-primary text-primary-foreground"
      };
    }
    return { 
      label: "Past", 
      variant: "outline" as const,
      isPast: true,
      isActive: false,
      className: "bg-muted text-muted-foreground border-muted"
    };
  };

  const selectedConference = conferences?.find(c => c.id === selectedConferenceId);
  
  // Filter conferences based on archived state
  const visibleConferences = conferences?.filter(c => showArchived ? c.archived : !c.archived);
  const archivedCount = conferences?.filter(c => c.archived).length || 0;

  return (
    <PageLayout>
      <PageHeader
        title="Conferences"
        description="Track conferences, capture leads, and convert them to opportunities"
        icon={<Calendar className="w-6 h-6" />}
      />

      <Card className="border-2 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setShowIngestDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Paste conference website URL (e.g., I/ITSEC, AFCEA, AFA)...
              </Button>
            </div>
            <Button onClick={() => setShowIngestDialog(true)}>
              Build from URL
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conference List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">
              {showArchived ? "Archived Conferences" : "My Conferences"}
            </h2>
            {archivedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="text-muted-foreground"
              >
                {showArchived ? (
                  <>
                    <Calendar className="w-4 h-4 mr-1" />
                    View Active
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-1" />
                    View Archived ({archivedCount})
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowImportDialog(true)}
              className="flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import from Calendar</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Conference
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Loading conferences...</p>
            </CardContent>
          </Card>
        ) : visibleConferences && visibleConferences.length > 0 ? (
          <div className="space-y-3">
            {visibleConferences.map((conference) => {
              const status = getConferenceStatus(conference.start_date, conference.end_date);
              const leadsCount = conference.conference_leads?.[0]?.count || 0;
              const isSelected = conference.id === selectedConferenceId;

              return (
                <Card
                  key={conference.id}
                  className={`cursor-pointer transition-all duration-200 border-l-4 ${
                    isSelected 
                      ? "ring-2 ring-primary shadow-lg bg-primary/5 border-l-primary" 
                      : status.isPast 
                        ? "opacity-60 hover:opacity-80 border-l-muted-foreground/30 hover:shadow-sm" 
                        : status.isActive
                          ? "border-l-success shadow-md hover:shadow-lg bg-success/5"
                          : "border-l-primary hover:shadow-md hover:border-l-primary"
                  }`}
                  onClick={() => setSelectedConferenceId(conference.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className={`text-base sm:text-lg ${status.isPast ? "text-muted-foreground" : ""}`}>
                            {conference.name}
                          </CardTitle>
                          {conference.is_shared && conference.owner_name && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {conference.owner_name}
                            </Badge>
                          )}
                          {conference.source_url && (
                            <Badge variant="secondary" className="text-xs">
                              Imported
                            </Badge>
                          )}
                        </div>
                        <CardDescription className={`mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm ${status.isPast ? "text-muted-foreground/70" : ""}`}>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseDateLocal(conference.start_date), "MMM d")} -{" "}
                            {format(parseDateLocal(conference.end_date), "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {conference.location}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`text-xs ${status.className}`}>{status.label}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/calendar');
                          }}
                          title="View in Calendar"
                        >
                          <CalendarDays className="w-4 h-4" />
                        </Button>
                        {conference.source_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(conference.source_url, '_blank');
                            }}
                            title="Open conference website"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Calendar invite-by-email removed in favor of in-app collaboration */}
                        {!conference.is_shared && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConferenceToEdit(conference.id);
                              }}
                              title="Edit conference"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveConferenceMutation.mutate({
                                  conferenceId: conference.id,
                                  archived: !conference.archived,
                                });
                              }}
                              title={conference.archived ? "Restore conference" : "Archive conference"}
                            >
                              {conference.archived ? (
                                <ArchiveRestore className="w-4 h-4" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConferenceToDelete(conference.id);
                              }}
                              title="Delete conference"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{leadsCount} {leadsCount === 1 ? "lead" : "leads"}</span>
                    </div>
                    {conference.tags && conference.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {conference.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              {showArchived ? (
                <>
                  <Archive className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No archived conferences</p>
                  <Button variant="outline" onClick={() => setShowArchived(false)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    View Active Conferences
                  </Button>
                </>
              ) : (
                <>
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No conferences yet</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Conference
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leads Panel - Full width on mobile, stacked below conferences */}
      {selectedConference && (
        <div className="animate-fade-in">
          <ConferenceLeadsPanel conference={selectedConference} />
        </div>
      )}

      <AddConferenceDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <ImportCalendarEventsDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
      <IngestFromUrlDialog open={showIngestDialog} onOpenChange={setShowIngestDialog} />
      <EditConferenceDialog
        open={!!conferenceToEdit}
        onOpenChange={(open) => !open && setConferenceToEdit(null)}
        conference={conferences?.find(c => c.id === conferenceToEdit) || null}
      />

      <AlertDialog open={!!conferenceToDelete} onOpenChange={(open) => !open && setConferenceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conference</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conference and all its leads. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conferenceToDelete && deleteConferenceMutation.mutate(conferenceToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}