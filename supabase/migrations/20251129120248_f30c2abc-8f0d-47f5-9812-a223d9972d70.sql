-- Add config table for sync tracking
CREATE TABLE IF NOT EXISTS public.sync_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- Allow system to manage sync config
CREATE POLICY "System can manage sync config"
  ON public.sync_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add missing fields to opportunities table if needed
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS sam_id text,
  ADD COLUMN IF NOT EXISTS sub_agency text,
  ADD COLUMN IF NOT EXISTS psc text,
  ADD COLUMN IF NOT EXISTS set_aside text,
  ADD COLUMN IF NOT EXISTS ai_tags text[],
  ADD COLUMN IF NOT EXISTS description text;

-- Create unique index on sam_id for upserts
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_sam_id_idx 
  ON public.opportunities(sam_id) 
  WHERE sam_id IS NOT NULL;

-- Add index for AI score queries
CREATE INDEX IF NOT EXISTS opportunities_ai_score_idx 
  ON public.opportunities(ai_fit_score) 
  WHERE ai_fit_score IS NOT NULL;

-- Add index for posted_date queries
CREATE INDEX IF NOT EXISTS opportunities_posted_date_idx 
  ON public.opportunities(posted_date DESC);

-- Initialize last_sam_sync_time if not exists
INSERT INTO public.sync_config (key, value)
VALUES ('last_sam_sync_time', to_jsonb((now() - interval '7 days')::text))
ON CONFLICT (key) DO NOTHING;