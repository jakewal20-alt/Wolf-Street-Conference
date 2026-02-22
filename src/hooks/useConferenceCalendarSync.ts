import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subDays, addDays, format } from "date-fns";
import { parseDateLocal } from "@/utils/dateHelpers";

export function useConferenceCalendarSync() {
  const queryClient = useQueryClient();

  const createCalendarEventForConference = async (conference: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
    description?: string | null;
    source_url?: string | null;
    tags?: string[] | null;
  }, travelDays?: {
    before: number;
    after: number;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If this conference is already linked, don't create duplicates
      const { data: existingConference, error: existingConferenceError } = await supabase
        .from("conferences")
        .select("calendar_event_id")
        .eq("id", conference.id)
        .maybeSingle();

      if (existingConferenceError) throw existingConferenceError;

      if (existingConference?.calendar_event_id) {
        return existingConference.calendar_event_id;
      }

      // Calculate calendar dates including travel days
      let calendarStartDate = conference.start_date;
      let calendarEndDate = conference.end_date;
      let title = conference.name;
      let description = conference.description || "";

      if (travelDays && (travelDays.before > 0 || travelDays.after > 0)) {
        const confStart = parseDateLocal(conference.start_date);
        const confEnd = parseDateLocal(conference.end_date);

        if (travelDays.before > 0) {
          calendarStartDate = format(subDays(confStart, travelDays.before), 'yyyy-MM-dd');
        }
        if (travelDays.after > 0) {
          calendarEndDate = format(addDays(confEnd, travelDays.after), 'yyyy-MM-dd');
        }

        // Build description with travel info
        const travelInfo = [];
        if (travelDays.before > 0) {
          travelInfo.push(`✈️ Travel: ${format(subDays(confStart, travelDays.before), 'MMM d')}`);
        }
        travelInfo.push(`📍 Conference: ${format(confStart, 'MMM d')} - ${format(confEnd, 'MMM d')}`);
        if (travelDays.after > 0) {
          travelInfo.push(`✈️ Return: ${format(addDays(confEnd, 1), 'MMM d')} - ${format(addDays(confEnd, travelDays.after), 'MMM d')}`);
        }

        description = travelInfo.join('\n') + (description ? '\n\n' + description : '');
      }

      // If the calendar event already exists (same user + same dates + same title), reuse it.
      const { data: existingEvent, error: existingEventError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", "conference")
        .eq("title", title)
        .eq("start_date", calendarStartDate)
        .eq("end_date", calendarEndDate)
        .maybeSingle();

      if (existingEventError) throw existingEventError;

      if (existingEvent?.id) {
        const { error: linkError } = await supabase
          .from("conferences")
          .update({
            calendar_event_id: existingEvent.id,
            calendar_source: "internal",
          })
          .eq("id", conference.id);

        if (linkError) throw linkError;

        queryClient.invalidateQueries({ queryKey: ["conferences"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

        return existingEvent.id;
      }

      // Create calendar event
      const { data: calendarEvent, error: eventError } = await supabase
        .from("calendar_events")
        .insert({
          title,
          start_date: calendarStartDate,
          end_date: calendarEndDate,
          location: conference.location || "",
          description,
          event_type: "conference",
          all_day: true,
          color: "#10b981", // green for conferences
          user_id: user.id,
          type: "conference",
          type_custom: null,
          color_hex: "#8B5CF6", // purple for conferences
          icon_name: "presentation",
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Link the calendar event to the conference
      const { error: linkError } = await supabase
        .from("conferences")
        .update({
          calendar_event_id: calendarEvent.id,
          calendar_source: "internal",
        })
        .eq("id", conference.id);

      if (linkError) throw linkError;

      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      return calendarEvent.id;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  };

  const updateCalendarEventWithTravelDays = async (
    calendarEventId: string,
    conference: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      location: string;
      description?: string | null;
    },
    travelDays?: {
      before: number;
      after: number;
    }
  ) => {
    try {
      // Calculate calendar dates including travel days
      let calendarStartDate = conference.start_date;
      let calendarEndDate = conference.end_date;
      let description = conference.description || "";

      if (travelDays && (travelDays.before > 0 || travelDays.after > 0)) {
        const confStart = parseDateLocal(conference.start_date);
        const confEnd = parseDateLocal(conference.end_date);
        
        if (travelDays.before > 0) {
          calendarStartDate = format(subDays(confStart, travelDays.before), 'yyyy-MM-dd');
        }
        if (travelDays.after > 0) {
          calendarEndDate = format(addDays(confEnd, travelDays.after), 'yyyy-MM-dd');
        }
        
        // Build description with travel info
        const travelInfo = [];
        if (travelDays.before > 0) {
          travelInfo.push(`✈️ Travel: ${format(subDays(confStart, travelDays.before), 'MMM d')}`);
        }
        travelInfo.push(`📍 Conference: ${format(confStart, 'MMM d')} - ${format(confEnd, 'MMM d')}`);
        if (travelDays.after > 0) {
          travelInfo.push(`✈️ Return: ${format(addDays(confEnd, 1), 'MMM d')} - ${format(addDays(confEnd, travelDays.after), 'MMM d')}`);
        }
        
        // Preserve existing description but prepend travel info
        const originalDesc = conference.description || "";
        // Remove any old travel info if it exists
        const cleanDesc = originalDesc.replace(/^(✈️.*\n?|📍.*\n?)+\n*/g, '').trim();
        description = travelInfo.join('\n') + (cleanDesc ? '\n\n' + cleanDesc : '');
      }

      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: conference.name,
          start_date: calendarStartDate,
          end_date: calendarEndDate,
          location: conference.location,
          description,
        })
        .eq("id", calendarEventId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    } catch (error) {
      console.error("Error updating calendar event with travel days:", error);
      throw error;
    }
  };

  const updateCalendarEventFromConference = async (
    calendarEventId: string,
    updates: {
      name?: string;
      start_date?: string;
      end_date?: string;
      location?: string;
      description?: string;
    }
  ) => {
    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: updates.name,
          start_date: updates.start_date,
          end_date: updates.end_date,
          location: updates.location,
          description: updates.description,
        })
        .eq("id", calendarEventId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (error) {
      console.error("Error updating calendar event:", error);
      throw error;
    }
  };

  const updateConferenceFromCalendarEvent = async (
    conferenceId: string,
    updates: {
      title?: string;
      start_date?: string;
      end_date?: string;
      location?: string;
    }
  ) => {
    try {
      const { error } = await supabase
        .from("conferences")
        .update({
          name: updates.title,
          start_date: updates.start_date,
          end_date: updates.end_date,
          location: updates.location,
        })
        .eq("id", conferenceId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    } catch (error) {
      console.error("Error updating conference:", error);
      throw error;
    }
  };

  const linkExistingCalendarEvent = async (
    conferenceId: string,
    calendarEventId: string
  ) => {
    try {
      const { error } = await supabase
        .from("conferences")
        .update({
          calendar_event_id: calendarEventId,
          calendar_source: "internal",
        })
        .eq("id", conferenceId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    } catch (error) {
      console.error("Error linking calendar event:", error);
      throw error;
    }
  };

  return {
    createCalendarEventForConference,
    updateCalendarEventFromConference,
    updateCalendarEventWithTravelDays,
    updateConferenceFromCalendarEvent,
    linkExistingCalendarEvent,
  };
}
