import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useConferenceCalendarSync } from "@/hooks/useConferenceCalendarSync";
import { parseDateLocal } from "@/utils/dateHelpers";

interface Conference {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  description?: string | null;
  tags?: string[] | null;
  calendar_event_id?: string | null;
}

interface EditConferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conference: Conference | null;
}

export function EditConferenceDialog({ open, onOpenChange, conference }: EditConferenceDialogProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const { updateCalendarEventFromConference } = useConferenceCalendarSync();

  // Populate form when conference changes
  useEffect(() => {
    if (conference) {
      setName(conference.name);
      setStartDate(parseDateLocal(conference.start_date));
      setEndDate(parseDateLocal(conference.end_date));
      setLocation(conference.location);
      setDescription(conference.description || "");
      setTags(conference.tags?.join(", ") || "");
    }
  }, [conference]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!conference || !name || !startDate || !endDate || !location) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsArray = tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const updatedData = {
        name,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        location,
        description: description || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };

      const { error } = await supabase
        .from("conferences")
        .update(updatedData)
        .eq("id", conference.id);

      if (error) throw error;

      // If there's a linked calendar event, update it too
      if (conference.calendar_event_id) {
        try {
          await updateCalendarEventFromConference(conference.calendar_event_id, {
            name: updatedData.name,
            start_date: updatedData.start_date,
            end_date: updatedData.end_date,
            location: updatedData.location,
            description: updatedData.description || undefined,
          });
        } catch (calendarError) {
          console.error("Failed to update calendar event:", calendarError);
          toast.error("Conference updated but calendar sync failed");
        }
      }

      toast.success("Conference updated");
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating conference:", error);
      toast.error("Failed to update conference");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Conference</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Conference Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., I/ITSEC 2025"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Orlando, FL"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about the conference..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., training, simulation, AI"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
