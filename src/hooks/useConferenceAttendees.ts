import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useConferenceAttendees(conferenceId?: string) {
  const queryClient = useQueryClient();

  // Fetch attendees for a conference (with profile info)
  const { data: attendees, isLoading: attendeesLoading } = useQuery({
    queryKey: ["conference-attendees", conferenceId],
    enabled: !!conferenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_attendees")
        .select("*, profiles!conference_attendees_user_id_fkey(id, email, full_name)")
        .eq("conference_id", conferenceId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all users with app access (for the dropdown)
  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Check if current user is attending
  const isCurrentUserAttending = attendees?.some(
    (a) => a.user_id === currentUser?.id
  );

  // Users not already attending (for dropdown)
  const availableUsers = allUsers?.filter(
    (u) => !attendees?.some((a) => a.user_id === u.id)
  );

  // Add attendee
  const addAttendeeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("conference_attendees")
        .insert({
          conference_id: conferenceId!,
          user_id: userId,
          added_by: user.id,
        })
        .select("*, profiles!conference_attendees_user_id_fkey(id, email, full_name)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["conference-attendees", conferenceId] });

      // Send calendar invite email
      try {
        await sendCalendarInvite(data.user_id);
        toast.success(`Added ${data.profiles?.full_name || data.profiles?.email} and sent calendar invite`);
      } catch {
        toast.success(`Added ${data.profiles?.full_name || data.profiles?.email} (invite email failed — check Resend config)`);
      }
    },
    onError: (error: any) => {
      if (error?.code === "23505") {
        toast.error("This person is already attending");
      } else {
        console.error("Error adding attendee:", error);
        toast.error("Failed to add attendee");
      }
    },
  });

  // Remove attendee
  const removeAttendeeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("conference_attendees")
        .delete()
        .eq("conference_id", conferenceId!)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conference-attendees", conferenceId] });
      toast.success("Attendee removed");
    },
    onError: (error) => {
      console.error("Error removing attendee:", error);
      toast.error("Failed to remove attendee");
    },
  });

  // Toggle current user's attendance
  const toggleMyAttendance = async () => {
    if (!currentUser) return;
    if (isCurrentUserAttending) {
      removeAttendeeMutation.mutate(currentUser.id);
    } else {
      addAttendeeMutation.mutate(currentUser.id);
    }
  };

  // Send calendar invite to a specific user
  const sendCalendarInvite = async (userId: string) => {
    if (!conferenceId) return;

    // Get the conference details
    const { data: conference, error: confError } = await supabase
      .from("conferences")
      .select("*")
      .eq("id", conferenceId)
      .single();
    if (confError || !conference) throw confError || new Error("Conference not found");

    // Get the recipient's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();
    if (profileError || !profile) throw profileError || new Error("Profile not found");

    // If there's a linked calendar event, use the existing send-calendar-invite function
    if (conference.calendar_event_id) {
      const { error } = await supabase.functions.invoke("send-calendar-invite", {
        body: {
          event_id: conference.calendar_event_id,
          test_email: profile.email,
        },
      });
      if (error) throw error;
    } else {
      // No linked calendar event — call send-calendar-invite with conference data directly
      // We'll create a temporary-style invocation using the conference info
      const { error } = await supabase.functions.invoke("send-conference-attendance-invite", {
        body: {
          conference_id: conferenceId,
          recipient_email: profile.email,
          recipient_name: profile.full_name,
        },
      });
      if (error) throw error;
    }

    // Mark as notified
    await supabase
      .from("conference_attendees")
      .update({ notified_at: new Date().toISOString() })
      .eq("conference_id", conferenceId)
      .eq("user_id", userId);
  };

  return {
    attendees,
    attendeesLoading,
    allUsers,
    availableUsers,
    currentUser,
    isCurrentUserAttending,
    addAttendee: addAttendeeMutation.mutate,
    removeAttendee: removeAttendeeMutation.mutate,
    toggleMyAttendance,
    isAdding: addAttendeeMutation.isPending,
    isRemoving: removeAttendeeMutation.isPending,
  };
}
