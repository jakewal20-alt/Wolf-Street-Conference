import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subDays, addDays, differenceInCalendarDays } from "date-fns";
import { parseDateLocal, safeFormat, tryParseDate } from "@/utils/dateHelpers";
import { getEventColor } from "@/utils/eventTypeHelpers";

// Conference ids with a calendar-event creation in flight. A double click (or
// two dialogs) reuses the same promise instead of inserting a second event.
const inFlightCreates = new Map<string, Promise<string>>();

// Travel days kept around a conference when it's edited (out before, home after).
const MAX_TRAVEL_DAYS = 3;

export function useConferenceCalendarSync() {
  const queryClient = useQueryClient();

  // Everything that shows conferences or calendar events, so no screen keeps
  // stale data after a sync.
  const invalidateConferenceCalendar = () => {
    for (const key of ["conferences", "calendar-events", "conference-linked-event-ids", "conference-dates-by-event", "today-command-center"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const createCalendarEventForConferenceOnce = async (conference: {
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
      const title = conference.name;
      let description = conference.description || "";

      if (travelDays && (travelDays.before > 0 || travelDays.after > 0)) {
        const confStart = parseDateLocal(conference.start_date);
        const confEnd = parseDateLocal(conference.end_date);

        if (travelDays.before > 0) {
          calendarStartDate = safeFormat(subDays(confStart, travelDays.before), 'yyyy-MM-dd', conference.start_date);
        }
        if (travelDays.after > 0) {
          calendarEndDate = safeFormat(addDays(confEnd, travelDays.after), 'yyyy-MM-dd', conference.end_date);
        }

        // Build description with travel info
        const travelInfo = [];
        if (travelDays.before > 0) {
          travelInfo.push(`✈️ Travel: ${safeFormat(subDays(confStart, travelDays.before), 'MMM d')}`);
        }
        travelInfo.push(`📍 Conference: ${safeFormat(confStart, 'MMM d')} - ${safeFormat(confEnd, 'MMM d')}`);
        if (travelDays.after > 0) {
          travelInfo.push(`✈️ Return: ${safeFormat(addDays(confEnd, 1), 'MMM d')} - ${safeFormat(addDays(confEnd, travelDays.after), 'MMM d')}`);
        }

        description = travelInfo.join('\n') + (description ? '\n\n' + description : '');
      }

      // If the calendar event already exists (same user + same dates + same title), reuse it.
      const { data: existingEvents, error: existingEventError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", "conference")
        .eq("title", title)
        .eq("start_date", calendarStartDate)
        .eq("end_date", calendarEndDate)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingEventError) throw existingEventError;

      // Older double-clicks may have left duplicates; reuse the oldest one.
      const existingEvent = existingEvents?.[0];
      if (existingEvent?.id) {
        const { error: linkError } = await supabase
          .from("conferences")
          .update({
            calendar_event_id: existingEvent.id,
            calendar_source: "internal",
          })
          .eq("id", conference.id);

        if (linkError) throw linkError;

        invalidateConferenceCalendar();

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
          color: getEventColor(null, "conference"),
          user_id: user.id,
          type: "conference",
          type_custom: null,
          color_hex: null, // follows the conference type colour
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

      invalidateConferenceCalendar();

      return calendarEvent.id;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  };

  const createCalendarEventForConference = (
    ...args: Parameters<typeof createCalendarEventForConferenceOnce>
  ): Promise<string> => {
    const conferenceId = args[0].id;
    const pending = inFlightCreates.get(conferenceId);
    if (pending) return pending;
    const promise = createCalendarEventForConferenceOnce(...args).finally(() => {
      inFlightCreates.delete(conferenceId);
    });
    inFlightCreates.set(conferenceId, promise);
    return promise;
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
          calendarStartDate = safeFormat(subDays(confStart, travelDays.before), 'yyyy-MM-dd', conference.start_date);
        }
        if (travelDays.after > 0) {
          calendarEndDate = safeFormat(addDays(confEnd, travelDays.after), 'yyyy-MM-dd', conference.end_date);
        }

        // Build description with travel info
        const travelInfo = [];
        if (travelDays.before > 0) {
          travelInfo.push(`✈️ Travel: ${safeFormat(subDays(confStart, travelDays.before), 'MMM d')}`);
        }
        travelInfo.push(`📍 Conference: ${safeFormat(confStart, 'MMM d')} - ${safeFormat(confEnd, 'MMM d')}`);
        if (travelDays.after > 0) {
          travelInfo.push(`✈️ Return: ${safeFormat(addDays(confEnd, 1), 'MMM d')} - ${safeFormat(addDays(confEnd, travelDays.after), 'MMM d')}`);
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

      invalidateConferenceCalendar();
    } catch (error) {
      console.error("Error updating calendar event with travel days:", error);
      throw error;
    }
  };

  /**
   * Update the conference's calendar entry after the conference itself was
   * edited. The entry may span travel days around the conference (e.g. out
   * the day before, home the day after); those offsets are measured against
   * the conference's previous dates and kept, so editing the conference
   * doesn't silently drop them.
   */
  const updateCalendarEventFromConference = async (
    calendarEventId: string,
    updates: {
      name: string;
      start_date: string;
      end_date: string;
      location?: string;
      description?: string;
    },
    previous?: { start_date: string; end_date: string | null },
  ) => {
    try {
      let travel = { before: 0, after: 0 };
      if (previous?.start_date) {
        const { data: event, error: readError } = await supabase
          .from("calendar_events")
          .select("start_date,end_date")
          .eq("id", calendarEventId)
          .maybeSingle();
        if (readError) throw readError;
        const evStart = tryParseDate(event?.start_date);
        const evEnd = tryParseDate(event?.end_date) ?? evStart;
        const oldStart = tryParseDate(previous.start_date);
        const oldEnd = tryParseDate(previous.end_date) ?? oldStart;
        if (evStart && evEnd && oldStart && oldEnd) {
          // Only small offsets are travel days; anything else is a calendar
          // entry that was moved on purpose, and the conference dates win.
          const clamp = (n: number) => (n > 0 && n <= MAX_TRAVEL_DAYS ? n : 0);
          travel = {
            before: clamp(differenceInCalendarDays(oldStart, evStart)),
            after: clamp(differenceInCalendarDays(evEnd, oldEnd)),
          };
        }
      }

      await updateCalendarEventWithTravelDays(
        calendarEventId,
        {
          id: "",
          name: updates.name,
          start_date: updates.start_date,
          end_date: updates.end_date,
          location: updates.location ?? "",
          description: updates.description ?? null,
        },
        travel,
      );
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

      invalidateConferenceCalendar();
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

      invalidateConferenceCalendar();
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
