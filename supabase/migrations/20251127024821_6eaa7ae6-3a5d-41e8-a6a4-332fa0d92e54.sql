-- Create meeting_notes table for tracking BD meeting notes
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE,
  attendees TEXT[],
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add deadline_alert field to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS deadline_alert TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_notes
CREATE POLICY "Users can view their own meeting notes"
  ON public.meeting_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meeting notes"
  ON public.meeting_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting notes"
  ON public.meeting_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting notes"
  ON public.meeting_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at on meeting_notes
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON public.meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();