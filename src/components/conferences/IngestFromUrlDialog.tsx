import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConferenceCalendarSync } from "@/hooks/useConferenceCalendarSync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertCircle, Plane } from "lucide-react";
import { format } from "date-fns";

interface IngestFromUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedConference {
  name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  short_description: string;
  tags: string[];
  registration_url?: string;
  venue?: string;
}

interface IngestResult {
  success: boolean;
  conference: ParsedConference;
  raw?: {
    error?: string;
    details?: string;
  };
}

export function IngestFromUrlDialog({ open, onOpenChange }: IngestFromUrlDialogProps) {
  const [url, setUrl] = useState("");
  const [parsedData, setParsedData] = useState<ParsedConference | null>(null);
  const [editedData, setEditedData] = useState<ParsedConference | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [addTravelDays, setAddTravelDays] = useState(false);
  const [travelDaysBefore, setTravelDaysBefore] = useState("1");
  const [travelDaysAfter, setTravelDaysAfter] = useState("1");
  const queryClient = useQueryClient();
  const { createCalendarEventForConference, updateCalendarEventWithTravelDays } = useConferenceCalendarSync();

  const ingestMutation = useMutation({
    mutationFn: async (conferenceUrl: string) => {
      console.log("=== Starting conference ingestion ===");
      console.log("URL:", conferenceUrl);
      
      const { data, error } = await supabase.functions.invoke('ingest-conference-from-url', {
        body: { url: conferenceUrl }
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      
      if (!data) {
        console.error("No data returned from edge function");
        throw new Error("No response from server");
      }
      
      if (!data.success) {
        console.error("Server returned failure:", data.error);
        throw new Error(data.error || "Failed to parse conference");
      }

      return data;
    },
    onSuccess: (data: IngestResult) => {
      setParsedData(data.conference);
      setEditedData(data.conference);
      
      // Check if this is a fallback result
      const isFallbackResult = data.raw?.error === 'fetch_failed';
      setIsFallback(isFallbackResult);
      
      if (isFallbackResult) {
        toast.info("Created stub conference from URL", {
          description: "Please complete the missing details manually.",
        });
      } else {
        toast.success("Conference data extracted successfully!");
      }
    },
    onError: (error) => {
      console.error("Mutation failed:", error);
      toast.error(
        "Failed to extract conference data",
        {
          description: error.message,
          duration: 5000,
        }
      );
    },
  });

  const handleIngest = () => {
    if (!url.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }
    ingestMutation.mutate(url);
  };

  const handleSave = async () => {
    if (!editedData) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // The conference was already created by the edge function
      // But we need to update it with any user edits and get the conference ID
      const { data: updatedConference, error } = await supabase
        .from('conferences')
        .update({
          name: editedData.name,
          start_date: editedData.start_date,
          end_date: editedData.end_date,
          location: editedData.location,
          description: editedData.short_description,
          tags: editedData.tags,
        })
        .eq('source_url', url)
        .eq('created_by', user.id)
        .select()
        .single();
      
      if (error) {
        console.error("Error updating conference:", error);
        toast.error("Failed to save changes: " + error.message);
        return;
      }
      
      // Auto-create or update calendar event with travel days
      if (editedData.start_date && editedData.end_date) {
        try {
          const travelDays = addTravelDays ? {
            before: parseInt(travelDaysBefore) || 0,
            after: parseInt(travelDaysAfter) || 0,
          } : undefined;

          if (updatedConference.calendar_event_id) {
            // Update existing calendar event with new dates (including travel)
            await updateCalendarEventWithTravelDays(
              updatedConference.calendar_event_id,
              {
                id: updatedConference.id,
                name: updatedConference.name,
                start_date: updatedConference.start_date,
                end_date: updatedConference.end_date,
                location: updatedConference.location || "",
                description: updatedConference.description,
              },
              travelDays
            );
          } else {
            // Create new calendar event
            await createCalendarEventForConference({
              id: updatedConference.id,
              name: updatedConference.name,
              start_date: updatedConference.start_date,
              end_date: updatedConference.end_date,
              location: updatedConference.location || "",
              description: updatedConference.description,
              source_url: updatedConference.source_url,
              tags: updatedConference.tags,
            }, travelDays);
          }
        } catch (calendarError) {
          console.error("Failed to update calendar event:", calendarError);
          toast.error("Conference saved but calendar sync failed");
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Conference saved and synced to calendar!");
      handleClose();
    } catch (error) {
      console.error("Error saving conference:", error);
      toast.error("Failed to save conference");
    }
  };

  const handleClose = () => {
    setUrl("");
    setParsedData(null);
    setEditedData(null);
    setIsFallback(false);
    setAddTravelDays(false);
    setTravelDaysBefore("1");
    setTravelDaysAfter("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Build Conference from URL</DialogTitle>
          <DialogDescription>
            Paste a conference website URL to automatically extract event details
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {!parsedData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Conference Website URL</Label>
                <Input
                  id="url"
                  placeholder="https://www.iitsec.org or https://www.afcea.org/events"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={ingestMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Examples: I/ITSEC, AFCEA TechNet, AFA Air & Space, AUSA Annual Meeting
                </p>
              </div>

              <Button
                onClick={handleIngest}
                disabled={ingestMutation.isPending || !url.trim()}
                className="w-full"
              >
                {ingestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting Conference Data...
                  </>
                ) : (
                  "Build from URL"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {isFallback && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    We couldn't read the website content, but we created a stub conference from the URL. 
                    Please fill in the missing details below.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Conference Name</Label>
                <Input
                  id="name"
                  value={editedData?.name || ""}
                  onChange={(e) => setEditedData(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={editedData?.start_date || ""}
                    onChange={(e) => setEditedData(prev => prev ? { ...prev, start_date: e.target.value || null } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={editedData?.end_date || ""}
                    onChange={(e) => setEditedData(prev => prev ? { ...prev, end_date: e.target.value || null } : null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Orlando, FL"
                  value={editedData?.location || ""}
                  onChange={(e) => setEditedData(prev => prev ? { ...prev, location: e.target.value || null } : null)}
                />
              </div>

              {editedData?.venue && (
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={editedData.venue}
                    onChange={(e) => setEditedData(prev => prev ? { ...prev, venue: e.target.value } : null)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={editedData?.short_description || ""}
                  onChange={(e) => setEditedData(prev => prev ? { ...prev, short_description: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={editedData?.tags.join(", ") || ""}
                  onChange={(e) => setEditedData(prev => prev ? { ...prev, tags: e.target.value.split(",").map(t => t.trim()) } : null)}
                />
              </div>

              {/* Travel Days Section */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="addTravelDays"
                    checked={addTravelDays}
                    onCheckedChange={(checked) => setAddTravelDays(checked === true)}
                  />
                  <Label htmlFor="addTravelDays" className="flex items-center gap-2 cursor-pointer">
                    <Plane className="h-4 w-4" />
                    Add travel days to calendar
                  </Label>
                </div>

                {addTravelDays && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="travelBefore">Days before event</Label>
                      <Select value={travelDaysBefore} onValueChange={setTravelDaysBefore}>
                        <SelectTrigger id="travelBefore">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="2">2 days</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="travelAfter">Days after event</Label>
                      <Select value={travelDaysAfter} onValueChange={setTravelDaysAfter}>
                        <SelectTrigger id="travelAfter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="2">2 days</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {parsedData && (
            <Button onClick={handleSave}>
              Save Conference
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
