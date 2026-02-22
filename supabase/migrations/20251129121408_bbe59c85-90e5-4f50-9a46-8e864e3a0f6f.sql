-- Add ai_reason and ai_bucket columns to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_bucket text;

-- Add index for bucket queries
CREATE INDEX IF NOT EXISTS opportunities_ai_bucket_idx 
  ON public.opportunities(ai_bucket) 
  WHERE ai_bucket IS NOT NULL;

-- Add check constraint for valid bucket values
ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_ai_bucket_check 
  CHECK (ai_bucket IN ('HIGH_PRIORITY', 'WATCH', 'INFO_ONLY') OR ai_bucket IS NULL);