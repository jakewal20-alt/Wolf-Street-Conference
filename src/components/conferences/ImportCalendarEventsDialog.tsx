import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar, MapPin } from "lucide-react";
import { parseDateLocal } from "@/utils/dateHelpers";

interface ImportCalendarEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCalendarEventsDialog({ open, onOpenChange }: ImportCalendarEventsDialogProps) {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch calendar events that look like conferences
  const { data: calendarEvents, isLoading } = useQuery({
    queryKey: ["calendar-events-for-import"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Filter for conference-like events
      const conferenceKeywords = [
        "conference", "summit", "expo", "symposium", "convention",
        "i/itsec", "itsec", "workshop", "forum", "seminar"
      ];

      return data.filter(event => {
        const titleLower = event.title.toLowerCase();
        const isConferenceType = event.event_type === "conference" || (event as any).type === "conference";
        const hasConferenceKeyword = conferenceKeywords.some(keyword => 
          titleLower.includes(keyword)
        );
        return isConferenceType || hasConferenceKeyword;
      });
    },
    enabled: open,
  });

  // Fetch existing conferences to check for duplicates
  const { data: existingConferences } = useQuery({
    queryKey: ["conferences-calendar-links"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("conferences")
        .select("calendar_event_id")
        .not("calendar_event_id", "is", null);

      if (error) throw error;
      return data.map(c => c.calendar_event_id);
    },
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const eventsToImport = calendarEvents?.filter(e => eventIds.includes(e.id)) || [];
      
      const conferencesToCreate = eventsToImport.map(event => ({
        name: event.title,
        start_date: event.start_date,
        end_date: event.end_date || event.start_date,
        location: event.location || "TBD",
        description: event.description,
        calendar_event_id: event.id,
        calendar_source: "internal",
        created_by: user.id,
      }));

      const { error } = await supabase
        .from("conferences")
        .insert(conferencesToCreate);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conferences imported successfully");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      onOpenChange(false);
      setSelectedEvents([]);
    },
    onError: (error) => {
      toast.error("Failed to import conferences: " + error.message);
    },
  });

  const handleToggle = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleImport = () => {
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }
    importMutation.mutate(selectedEvents);
  };

  const availableEvents = calendarEvents?.filter(
    event => !existingConferences?.includes(event.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Calendar</DialogTitle>
          <DialogDescription>
            Select calendar events to import as conferences. Events already linked are hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading events...</p>
          ) : availableEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conference-like events found in your calendar.
            </p>
          ) : (
            availableEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedEvents.includes(event.id)}
                  onCheckedChange={() => handleToggle(event.id)}
                />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{event.title}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseDateLocal(event.start_date), "MMM d")}
                      {event.end_date && event.end_date !== event.start_date && (
                        <> - {format(parseDateLocal(event.end_date), "MMM d, yyyy")}</>
                      )}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedEvents.length === 0 || importMutation.isPending}
          >
            {importMutation.isPending
              ? "Importing..."
              : `Import ${selectedEvents.length} ${selectedEvents.length === 1 ? "Event" : "Events"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
