import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addMonths, isToday, isPast, eachDayOfInterval } from "date-fns";
import { parseDateLocal, safeFormat } from "@/utils/dateHelpers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3x3, Rows3, List, Download, Plus, Loader2, Sparkles, Mail } from "lucide-react";
import { OutlookSyncButton } from "@/components/calendar/OutlookSyncButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EventTypeSelector } from "@/components/calendar/EventTypeSelector";
import { ColorPicker } from "@/components/calendar/ColorPicker";
import { IconSelector } from "@/components/calendar/IconSelector";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { getEventTypeLabel, getEventColor, getEventIcon } from "@/utils/eventTypeHelpers";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  location: string | null;
  color: string;
  type: string | null;
  type_custom: string | null;
  color_hex: string | null;
  icon_name: string | null;
  invite_email: string | null;
  registration_url: string | null;
}

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [customEventType, setCustomEventType] = useState("travel");
  const [customEventDescription, setCustomEventDescription] = useState("");
  const [customEventLocation, setCustomEventLocation] = useState("");
  const [customEventInviteEmail, setCustomEventInviteEmail] = useState("");
  const [customEventStartDate, setCustomEventStartDate] = useState<Date | null>(null);
  const [customEventEndDate, setCustomEventEndDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showDayEventsDialog, setShowDayEventsDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = addDays(calendarStart, 41); // 6 weeks
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch conference-linked calendar event IDs (used to hide orphan duplicates)
  const { data: conferenceLinkedEventIds = [] } = useQuery({
    queryKey: ["conference-linked-event-ids"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("conferences")
        .select("calendar_event_id")
        .not("calendar_event_id", "is", null);

      if (error) throw error;
      return (data || []).map(c => c.calendar_event_id).filter(Boolean) as string[];
    },
  });

  const { data: calendarEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events", conferenceLinkedEventIds],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch ALL calendar events (shared across all users)
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Keep only conference events that are actually linked to a conference.
      // This hides orphan duplicates created by repeated ingestion.
      return ((data || []).filter((event) => {
        if (event.event_type === "conference") {
          return conferenceLinkedEventIds.includes(event.id);
        }
        return true;
      })) as CalendarEvent[];
    },
  });

  const createCalendarEventMutation = useMutation({
    mutationFn: async (newEvent: {
      title: string;
      description: string;
      event_type: string;
      start_date: string;
      end_date: string | null;
      location: string;
      invite_email: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("calendar_events")
        .insert([{
          ...newEvent,
          user_id: user.id,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event created",
        description: "New event added to calendar.",
      });
      setShowQuickAdd(false);
      setNewEventTitle("");
      setCustomEventDescription("");
      setCustomEventLocation("");
      setCustomEventInviteEmail("");
      setCustomEventType("travel");
      setCustomEventStartDate(null);
      setCustomEventEndDate(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create event.",
        variant: "destructive",
      });
    },
  });

  const updateCalendarEventMutation = useMutation({
    mutationFn: async (updatedEvent: {
      id: string;
      title: string;
      description: string;
      event_type: string;
      start_date: string;
      end_date: string | null;
      location: string;
      type: string | null;
      type_custom: string | null;
      color_hex: string | null;
      icon_name: string | null;
      invite_email: string | null;
      registration_url: string | null;
    }) => {
      const { id, ...updates } = updatedEvent;
      const { error } = await supabase
        .from("calendar_events")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event updated",
        description: "Calendar event has been updated.",
      });
      setShowEventDialog(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update event.",
        variant: "destructive",
      });
    },
  });

  const deleteCalendarEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Event deleted",
        description: "Calendar event has been removed.",
      });
      setShowEventDialog(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    },
  });

  const sendCalendarInviteMutation = useMutation({
    mutationFn: async ({ eventId, email }: { eventId: string; email?: string }) => {
      // If custom email provided, send as test_email to override
      const body: { event_id: string; test_email?: string } = { event_id: eventId };

      if (email) {
        body.test_email = email;
      } else {
        // Send to self - get user's email from profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", user.id)
          .single();

        if (profile?.email) {
          body.test_email = profile.email;
        }
      }

      const { data, error } = await supabase.functions.invoke("send-calendar-invite", {
        body,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Invite sent",
        description: `Calendar invite sent to ${data.recipient}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invite",
        description: error.message || "Could not send calendar invite.",
        variant: "destructive",
      });
    },
  });

  const getCalendarEventsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarEvents.filter((event) => {
      const eventStartStr = event.start_date.split('T')[0];
      const eventEndStr = event.end_date ? event.end_date.split('T')[0] : eventStartStr;

      // Check if date falls within the event date range (inclusive)
      return dateStr >= eventStartStr && dateStr <= eventEndStr;
    });
  };

  const handleEventClick = async (event: CalendarEvent) => {
    // If it's a conference event, check if it's linked to a conference
    if (event.event_type === "conference" || event.type === "conference") {
      const { data: conference } = await supabase
        .from("conferences")
        .select("id")
        .eq("calendar_event_id", event.id)
        .single();

      if (conference) {
        navigate(`/conferences?selected=${conference.id}`);
        return;
      }
    }

    // Otherwise show the event dialog
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleQuickAdd = () => {
    if (!newEventTitle) return;

    // Use customEventStartDate if available, fallback to quickAddDate
    const startDate = customEventStartDate || quickAddDate;
    if (!startDate) return;

    createCalendarEventMutation.mutate({
      title: newEventTitle,
      description: customEventDescription,
      event_type: customEventType,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: customEventEndDate ? format(customEventEndDate, "yyyy-MM-dd") : null,
      location: customEventLocation,
      invite_email: customEventInviteEmail || null,
    });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDay(date);
    setShowDayEventsDialog(true);
  };

  const handleAddEventFromDay = () => {
    if (!selectedDay) return;
    setShowDayEventsDialog(false);
    setQuickAddDate(selectedDay);
    setCustomEventStartDate(selectedDay);
    setShowQuickAdd(true);
  };

  const exportToICalendar = () => {
    const icsEvents = calendarEvents
      .map(event => {
        const startDate = parseDateLocal(event.start_date);
        const formattedStart = safeFormat(startDate, "yyyyMMdd'T'HHmmss'Z'", "");
        const endDate = event.end_date ? parseDateLocal(event.end_date) : startDate;
        const formattedEnd = safeFormat(endDate, "yyyyMMdd'T'HHmmss'Z'", "");
        return [
          'BEGIN:VEVENT',
          `UID:${event.id}@calendar.app`,
          `DTSTAMP:${formattedStart}`,
          `DTSTART:${formattedStart}`,
          `DTEND:${formattedEnd}`,
          `SUMMARY:${event.title}`,
          `DESCRIPTION:${event.description || ''}`,
          `LOCATION:${event.location || ''}`,
          'END:VEVENT'
        ].join('\\r\\n');
      });

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Calendar//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      ...icsEvents,
      'END:VCALENDAR'
    ].join('\\r\\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `calendar-export-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Calendar exported",
      description: "Your calendar has been downloaded as an iCalendar file.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto flex gap-6">
        {/* Mini Calendar Sidebar */}
        <aside className="w-80 space-y-4">
          {/* Glassmorphism Mini Calendar */}
          <Card className="p-5 shadow-xl border backdrop-blur-md bg-card/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            <h3 className="font-display font-semibold mb-4 text-sm text-foreground/80 flex items-center gap-2 relative z-10">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Navigation
            </h3>
            <CalendarPicker
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && setCurrentDate(date)}
              className="rounded-md pointer-events-auto relative z-10"
            />
          </Card>

          {/* Quick Actions - Glassmorphism */}
          <Card className="p-5 shadow-xl border backdrop-blur-md bg-card/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/10 pointer-events-none" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="font-display font-semibold text-sm text-foreground/80">Quick Actions</h3>
            </div>
            <div className="space-y-2 relative z-10">
              <Button
                className="w-full justify-start gap-2 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                onClick={() => handleDateClick(currentDate)}
              >
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 hover:bg-accent hover:scale-[1.02] transition-all duration-200"
                onClick={exportToICalendar}
              >
                <Download className="h-4 w-4" />
                Export Calendar
              </Button>

              {/* Outlook Sync Button */}
              <OutlookSyncButton calendarEvents={calendarEvents} />
            </div>
          </Card>

          {/* Upcoming Events - Glassmorphism */}
          <Card className="p-5 shadow-xl border backdrop-blur-md bg-card/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-success/5 pointer-events-none" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/50" />
              <h3 className="font-display font-semibold text-sm text-foreground/80">Upcoming Events</h3>
            </div>
            <ScrollArea className="h-[280px] relative z-10">
              <div className="space-y-2 pr-4">
                {calendarEvents
                  .filter((event) => {
                    const now = new Date();
                    const endDate = event.end_date ? parseDateLocal(event.end_date) : parseDateLocal(event.start_date);
                    return endDate >= now;
                  })
                  .sort((a, b) => parseDateLocal(a.start_date).getTime() - parseDateLocal(b.start_date).getTime())
                  .slice(0, 5)
                  .map((event, index) => {
                    const effectiveType = event.type ?? event.event_type;
                    const eventColor = getEventColor(event.color_hex, effectiveType);
                    const EventIcon = getEventIcon(event.icon_name, effectiveType);
                    const eventLabel = getEventTypeLabel(effectiveType, event.type_custom);

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs p-3 rounded-lg border cursor-pointer",
                          "hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5",
                          "transition-all duration-300 ease-out",
                          "animate-fade-in"
                        )}
                        style={{
                          backgroundColor: `${eventColor}15`,
                          borderLeftColor: eventColor,
                          borderLeftWidth: '4px',
                          animationDelay: `${index * 50}ms`
                        }}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDialog(true);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <EventIcon className="h-3 w-3" style={{ color: eventColor }} />
                          <Badge variant="secondary" className="text-[10px] px-1">{eventLabel}</Badge>
                          <div className="font-semibold truncate flex-1">{event.title}</div>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {safeFormat(event.start_date, "MMM d, yyyy")}
                        </div>
                        {event.registration_url && (
                          <a
                            href={event.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-[10px] mt-1 block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Register →
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </Card>
        </aside>

        {/* Main Calendar Area */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <Card className="p-6 shadow-xl border-2 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-display font-bold text-foreground mb-2">Calendar</h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Track conferences and events
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border-2 rounded-xl p-1 bg-card shadow-sm">
                  <Button
                    variant={viewMode === "day" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("day")}
                    className="transition-all"
                  >
                    <List className="h-4 w-4 mr-1" />
                    Day
                  </Button>
                  <Button
                    variant={viewMode === "week" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("week")}
                    className="transition-all"
                  >
                    <Rows3 className="h-4 w-4 mr-1" />
                    Week
                  </Button>
                  <Button
                    variant={viewMode === "month" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("month")}
                    className="transition-all"
                  >
                    <Grid3x3 className="h-4 w-4 mr-1" />
                    Month
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="shadow-sm hover:shadow-md transition-all"
                    onClick={() => {
                      if (viewMode === "day") setCurrentDate(addDays(currentDate, -1));
                      else if (viewMode === "week") setCurrentDate(addDays(currentDate, -7));
                      else setCurrentDate(addMonths(currentDate, -1));
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="shadow-sm hover:shadow-md transition-all"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shadow-sm hover:shadow-md transition-all"
                    onClick={() => {
                      if (viewMode === "day") setCurrentDate(addDays(currentDate, 1));
                      else if (viewMode === "week") setCurrentDate(addDays(currentDate, 7));
                      else setCurrentDate(addMonths(currentDate, 1));
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Calendar Legend Bar */}
          <Card className="p-4 shadow-xl border backdrop-blur-sm bg-card/95 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-accent/3 pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <CalendarLegend className="flex-1" />
            </div>
          </Card>

          {/* Calendar Display */}
          <Card className="p-6 shadow-xl border-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold flex items-center gap-3">
                <CalendarIcon className="h-6 w-6 text-primary" />
                {viewMode === "day"
                  ? format(currentDate, "EEEE, MMMM d, yyyy")
                  : viewMode === "week"
                  ? `Week of ${format(weekStart, "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(prev => addMonths(prev, -1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {viewMode === "day" ? (
              <div className="space-y-4">
                {/* Time-based agenda view */}
                <div className="border rounded-lg">
                  <div className="bg-muted/50 p-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">All Day</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDateClick(currentDate)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {getCalendarEventsForDay(currentDate).length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No events scheduled for this day
                      </p>
                    ) : (
                      <>
                        {getCalendarEventsForDay(currentDate).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-shadow",
                              event.event_type === "conference" && "bg-success/10"
                            )}
                            style={{
                              backgroundColor: event.event_type === "conference" ? undefined : `${event.color}10`,
                              borderLeftColor: event.event_type === "conference" ? "#10b981" : event.color
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="mb-2 flex items-center gap-2">
                                  <Badge
                                    variant={event.event_type === "conference" ? "default" : "outline"}
                                    className="text-xs"
                                  >
                                    {event.event_type === "conference" ? "Conference" : event.event_type}
                                  </Badge>
                                </div>
                                <h3 className="font-semibold text-base mb-1">
                                  {event.title}
                                </h3>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    {event.description}
                                  </p>
                                )}
                                {event.location && (
                                  <p className="text-sm text-muted-foreground">
                                    {event.location}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : viewMode === "week" ? (
              <div className="grid grid-cols-7 gap-4">
                {weekDays.map((day) => {
                  const dayEvents = getCalendarEventsForDay(day);
                  const isCurrentDay = isToday(day);
                  const isPastDay = isPast(day) && !isCurrentDay;

                  return (
                    <div
                      key={day.toISOString()}
                      id={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "min-h-[400px] border-2 rounded-lg p-3 space-y-2 cursor-pointer",
                        isCurrentDay && "border-primary bg-primary/5",
                        isPastDay && "bg-muted/30",
                        !isCurrentDay && !isPastDay && "border-border"
                      )}
                      onClick={() => handleDateClick(day)}
                    >
                      <div className="sticky top-0 bg-background/95 backdrop-blur-sm pb-2">
                        <div className="font-semibold text-sm text-foreground">
                          {format(day, "EEE")}
                        </div>
                        <div className={cn(
                          "text-2xl font-bold",
                          isCurrentDay && "text-primary"
                        )}>
                          {format(day, "d")}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {dayEvents.length} items
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {dayEvents.map((event) => {
                          const effectiveType = event.type ?? event.event_type;
                          const EventIcon = getEventIcon(event.icon_name, effectiveType);
                          const eventColor = getEventColor(event.color_hex, effectiveType);
                          const eventLabel = getEventTypeLabel(effectiveType, event.type_custom);

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "p-2 rounded-md border-l-4 text-xs cursor-pointer hover:shadow-md transition-shadow"
                              )}
                              style={{
                                backgroundColor: `${eventColor}15`,
                                borderLeftColor: eventColor
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <EventIcon className="h-3 w-3" style={{ color: eventColor }} />
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">{eventLabel}</Badge>
                                <div className="font-medium truncate flex-1">{event.title}</div>
                              </div>
                              {event.location && (
                                <div className="text-muted-foreground truncate">{event.location}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Month grid header */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        "text-center text-sm font-semibold text-muted-foreground/70 p-2 rounded-lg",
                        "uppercase tracking-wider",
                        index === 0 || index === 6 ? "bg-muted/30" : ""
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Month grid */}
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((day, index) => {
                    const dayEvents = getCalendarEventsForDay(day);
                    const isCurrentDay = isToday(day);
                    const isPastDay = isPast(day) && !isCurrentDay;
                    const isCurrentMonth = day >= monthStart && day <= monthEnd;
                    const hasItems = dayEvents.length > 0;

                    return (
                      <div
                        key={day.toISOString()}
                        id={format(day, "yyyy-MM-dd")}
                        className={cn(
                          "min-h-[120px] rounded-xl p-2 space-y-1 cursor-pointer",
                          "border transition-all duration-300 ease-out",
                          "hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5",
                          "group relative overflow-hidden",
                          isCurrentDay && "border-primary border-2 bg-primary/5 shadow-md ring-2 ring-primary/20",
                          isPastDay && "bg-muted/20 hover:bg-muted/30",
                          !isCurrentMonth && "opacity-30 hover:opacity-50",
                          !isCurrentDay && !isPastDay && isCurrentMonth && "border-border/50 hover:border-primary/50 bg-card/50",
                          hasItems && !isCurrentDay && "border-accent/30"
                        )}
                        style={{ animationDelay: `${index * 10}ms` }}
                        onClick={() => handleDateClick(day)}
                      >
                        {/* Hover gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        {/* Day number */}
                        <div className={cn(
                          "text-sm font-bold relative z-10 flex items-center justify-between",
                          isCurrentDay && "text-primary",
                          !isCurrentMonth && "text-muted-foreground/50"
                        )}>
                          <span className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200",
                            isCurrentDay && "bg-primary text-primary-foreground shadow-md",
                            !isCurrentDay && "group-hover:bg-accent/50"
                          )}>
                            {format(day, "d")}
                          </span>
                          {hasItems && !isCurrentDay && (
                            <span className="flex gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            </span>
                          )}
                        </div>

                        {/* Events list */}
                        <div className="space-y-1 relative z-10">
                          {dayEvents.slice(0, 2).map((event, eventIndex) => {
                            const effectiveType = event.type ?? event.event_type;
                            const eventColor = getEventColor(event.color_hex, effectiveType);
                            const EventIcon = getEventIcon(event.icon_name, effectiveType);

                            return (
                              <div
                                key={event.id}
                                className={cn(
                                  "text-xs p-1.5 rounded-md truncate cursor-pointer flex items-center gap-1",
                                  "transition-all duration-200 ease-out",
                                  "hover:shadow-md hover:scale-[1.03]",
                                  "animate-fade-in"
                                )}
                                style={{
                                  backgroundColor: `${eventColor}20`,
                                  borderLeft: `3px solid ${eventColor}`,
                                  color: eventColor,
                                  animationDelay: `${eventIndex * 50}ms`
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEventClick(event);
                                }}
                              >
                                <EventIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{event.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className={cn(
                              "text-xs text-muted-foreground text-center py-0.5 rounded-md",
                              "bg-muted/50 group-hover:bg-primary/10 transition-colors"
                            )}>
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Day Events Dialog */}
      <Dialog open={showDayEventsDialog} onOpenChange={setShowDayEventsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {selectedDay && format(selectedDay, "EEEE, MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription>
              All events for this day
            </DialogDescription>
          </DialogHeader>

          {selectedDay && (() => {
            const dayEvts = getCalendarEventsForDay(selectedDay);

            return (
              <div className="space-y-3 mt-2">
                {dayEvts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">
                    No events scheduled for this day
                  </p>
                ) : (
                  <>
                    {dayEvts.map((event) => {
                      const effectiveType = event.type ?? event.event_type;
                      const eventColor = getEventColor(event.color_hex, effectiveType);
                      const EventIcon = getEventIcon(event.icon_name, effectiveType);
                      const eventLabel = getEventTypeLabel(effectiveType, event.type_custom);

                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer",
                            "hover:shadow-md transition-all duration-200"
                          )}
                          style={{
                            backgroundColor: `${eventColor}15`,
                            borderLeft: `4px solid ${eventColor}`,
                          }}
                          onClick={() => {
                            setShowDayEventsDialog(false);
                            handleEventClick(event);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <EventIcon className="h-4 w-4" style={{ color: eventColor }} />
                            <Badge variant="secondary" className="text-xs">{eventLabel}</Badge>
                          </div>
                          <h4 className="font-semibold text-sm">{event.title}</h4>
                          {event.location && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.location}</p>
                          )}
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                <Button
                  className="w-full gap-2 mt-2"
                  onClick={handleAddEventFromDay}
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>
              Create a new event for {quickAddDate && format(quickAddDate, "MMMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="event-type">Event Type *</Label>
              <Select value={customEventType} onValueChange={setCustomEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-title">Title *</Label>
              <Input
                id="custom-title"
                placeholder="e.g., Travel to DC for meeting"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Washington, DC"
                value={customEventLocation}
                onChange={(e) => setCustomEventLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Send Invite To (Email)</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="e.g., colleague@company.com"
                value={customEventInviteEmail}
                onChange={(e) => setCustomEventInviteEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to send to yourself
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEventStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEventStartDate ? format(customEventStartDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={customEventStartDate || undefined}
                      onSelect={(date) => {
                        setCustomEventStartDate(date || null);
                        // Clear end date if it's before the new start date
                        if (customEventEndDate && date && customEventEndDate < date) {
                          setCustomEventEndDate(null);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEventEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEventEndDate ? format(customEventEndDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={customEventEndDate || undefined}
                      onSelect={(date) => setCustomEventEndDate(date || null)}
                      disabled={(date) => (customEventStartDate ? date < customEventStartDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add notes about this event"
                value={customEventDescription}
                onChange={(e) => setCustomEventDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!newEventTitle || createCalendarEventMutation.isPending}
            >
              {createCalendarEventMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update or delete this calendar event
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {selectedEvent && (
              <div className="space-y-4 py-4">
                <EventTypeSelector
                  type={selectedEvent.type}
                  typeCustom={selectedEvent.type_custom}
                  onChange={(type, typeCustom) =>
                    setSelectedEvent({...selectedEvent, type, type_custom: typeCustom})
                  }
                />

                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={selectedEvent.title}
                    onChange={(e) => setSelectedEvent({...selectedEvent, title: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={selectedEvent.location || ""}
                    onChange={(e) => setSelectedEvent({...selectedEvent, location: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-registration-url">Registration URL</Label>
                  <Input
                    id="edit-registration-url"
                    type="url"
                    placeholder="https://example.com/register"
                    value={selectedEvent.registration_url || ""}
                    onChange={(e) => setSelectedEvent({...selectedEvent, registration_url: e.target.value || null})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to event registration page
                  </p>
                </div>

                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label className="font-medium">Send Calendar Invite</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={sendCalendarInviteMutation.isPending}
                    onClick={() => {
                      if (selectedEvent) {
                        sendCalendarInviteMutation.mutate({ eventId: selectedEvent.id });
                      }
                    }}
                  >
                    {sendCalendarInviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Send to Myself
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-muted/30 px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="edit-invite-email"
                      type="email"
                      placeholder="recipient@example.com"
                      value={selectedEvent.invite_email || ""}
                      onChange={(e) => setSelectedEvent({...selectedEvent, invite_email: e.target.value || null})}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={!selectedEvent.invite_email || sendCalendarInviteMutation.isPending}
                      onClick={() => {
                        if (selectedEvent?.invite_email) {
                          sendCalendarInviteMutation.mutate({
                            eventId: selectedEvent.id,
                            email: selectedEvent.invite_email
                          });
                        }
                      }}
                    >
                      {sendCalendarInviteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedEvent.start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedEvent.start_date ? safeFormat(selectedEvent.start_date, "PPP", "Pick a date") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={parseDateLocal(selectedEvent.start_date)}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedEvent({...selectedEvent, start_date: format(date, "yyyy-MM-dd")});
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedEvent.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedEvent.end_date ? safeFormat(selectedEvent.end_date, "PPP", "Pick a date") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={selectedEvent.end_date ? parseDateLocal(selectedEvent.end_date) : undefined}
                          onSelect={(date) => {
                            setSelectedEvent({
                              ...selectedEvent,
                              end_date: date ? format(date, "yyyy-MM-dd") : null
                            });
                          }}
                          disabled={(date) => date < parseDateLocal(selectedEvent.start_date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={selectedEvent.description || ""}
                    onChange={(e) => setSelectedEvent({...selectedEvent, description: e.target.value})}
                    rows={3}
                  />
                </div>

                <ColorPicker
                  value={selectedEvent.color_hex}
                  onChange={(color_hex) => setSelectedEvent({...selectedEvent, color_hex})}
                />

                <IconSelector
                  value={selectedEvent.icon_name}
                  onChange={(icon_name) => setSelectedEvent({...selectedEvent, icon_name})}
                />
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={() => selectedEvent && deleteCalendarEventMutation.mutate(selectedEvent.id)}
              disabled={deleteCalendarEventMutation.isPending}
            >
              {deleteCalendarEventMutation.isPending ? "Deleting..." : "Delete Event"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedEvent) {
                    updateCalendarEventMutation.mutate({
                      id: selectedEvent.id,
                      title: selectedEvent.title,
                      description: selectedEvent.description || "",
                      event_type: selectedEvent.event_type,
                      start_date: selectedEvent.start_date,
                      end_date: selectedEvent.end_date,
                      location: selectedEvent.location || "",
                      type: selectedEvent.type,
                      type_custom: selectedEvent.type_custom,
                      color_hex: selectedEvent.color_hex,
                      icon_name: selectedEvent.icon_name,
                      invite_email: selectedEvent.invite_email,
                      registration_url: selectedEvent.registration_url,
                    });
                  }
                }}
                disabled={!selectedEvent?.title || updateCalendarEventMutation.isPending}
              >
                {updateCalendarEventMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
