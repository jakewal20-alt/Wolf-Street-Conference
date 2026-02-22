-- Drop the old check constraint that doesn't allow OUT_OF_SCOPE
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

-- Add new check constraint that includes OUT_OF_SCOPE
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_ai_bucket_check 
  CHECK (ai_bucket IN ('HIGH_PRIORITY', 'WATCH', 'INFO_ONLY', 'OUT_OF_SCOPE', 'REVIEW'));