-- Timed calendar events (meetings) record which time zone their start/end
-- times are in. NULL = all-day event, or a timed event saved before this column.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS time_zone text;
