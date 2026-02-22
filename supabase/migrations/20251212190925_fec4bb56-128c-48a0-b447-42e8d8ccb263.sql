-- Create a function that calls the send-calendar-invite edge function
CREATE OR REPLACE FUNCTION public.trigger_send_calendar_invite()
RETURNS trigger AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get the Supabase URL from the current database
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Make HTTP request to the edge function
  PERFORM net.http_post(
    url := 'https://murkjzfsfqhxphwndebq.supabase.co/functions/v1/send-calendar-invite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cmtqemZzZnFoeHBod25kZWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzUzOTUsImV4cCI6MjA3OTc1MTM5NX0.V-QqE1A8TgaoN_hQPRA0yGfLcXjraEaKMj_y_4FK1Zc'
    ),
    body := jsonb_build_object('event_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on calendar_events table
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;

CREATE TRIGGER on_calendar_event_created
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_calendar_invite();