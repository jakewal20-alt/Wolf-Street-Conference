-- Create daily_briefs table for persisted daily summaries
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  summary_text TEXT NOT NULL,
  key_headlines JSONB DEFAULT '[]'::jsonb,
  opportunity_highlights JSONB DEFAULT '[]'::jsonb,
  trends JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, brief_date)
);

-- Enable RLS
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own daily briefs"
  ON public.daily_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily briefs"
  ON public.daily_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily briefs"
  ON public.daily_briefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily briefs"
  ON public.daily_briefs FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_briefs_updated_at
  BEFORE UPDATE ON public.daily_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_daily_briefs_user_date ON public.daily_briefs(user_id, brief_date DESC);