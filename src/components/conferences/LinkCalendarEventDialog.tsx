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
import { toast } from "sonner";
import { safeFormat } from "@/utils/dateHelpers";
import { Calendar, MapPin } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface LinkCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
  conferenceName: string;
}

export function LinkCalendarEventDialog({
  open,
  onOpenChange,
  conferenceId,
  conferenceName,
}: LinkCalendarEventDialogProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch calendar events from the last 60 days
  const { data: calendarEvents, isLoading } = useQuery({
    queryKey: ["calendar-events-for-linking"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", sixtyDaysAgo.toISOString().split('T')[0])
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const selectedEvent = calendarEvents?.find(e => e.id === eventId);
      if (!selectedEvent) throw new Error("Event not found");

      const { error } = await supabase
        .from("conferences")
        .update({
          calendar_event_id: eventId,
          calendar_source: "internal",
          // Only update dates if they're not set
          start_date: selectedEvent.start_date,
          end_date: selectedEvent.end_date || selectedEvent.start_date,
        })
        .eq("id", conferenceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calendar event linked successfully");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      onOpenChange(false);
      setSelectedEventId("");
    },
    onError: (error) => {
      toast.error("Failed to link calendar event: " + error.message);
    },
  });

  const handleLink = () => {
    if (!selectedEventId) {
      toast.error("Please select a calendar event");
      return;
    }
    linkMutation.mutate(selectedEventId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link to Calendar Event</DialogTitle>
          <DialogDescription>
            Select a calendar event to link with "{conferenceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading events...</p>
          ) : !calendarEvents || calendarEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No calendar events found in the last 60 days.
            </p>
          ) : (
            <RadioGroup value={selectedEventId} onValueChange={setSelectedEventId}>
              <div className="space-y-3">
                {calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <RadioGroupItem value={event.id} id={event.id} />
                    <Label htmlFor={event.id} className="flex-1 cursor-pointer space-y-1">
                      <p className="font-medium">{event.title}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {safeFormat(event.start_date, "MMM d")}
                          {event.end_date && event.end_date !== event.start_date && (
                            <> - {safeFormat(event.end_date, "MMM d, yyyy")}</>
                          )}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedEventId || linkMutation.isPending}
          >
            {linkMutation.isPending ? "Linking..." : "Link Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
