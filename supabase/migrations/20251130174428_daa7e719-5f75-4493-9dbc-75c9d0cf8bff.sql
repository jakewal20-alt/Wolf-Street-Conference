-- Add calendar linking columns to conferences table
ALTER TABLE public.conferences
ADD COLUMN calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
ADD COLUMN calendar_source text;

-- Create index for faster lookups
CREATE INDEX idx_conferences_calendar_event_id ON public.conferences(calendar_event_id);

-- Add comment
COMMENT ON COLUMN public.conferences.calendar_event_id IS 'ID of linked calendar event';
COMMENT ON COLUMN public.conferences.calendar_source IS 'Source of calendar event: internal, google, etc.';