-- Drop the old constraint and add new one with updated bucket values
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_ai_bucket_check 
CHECK (ai_bucket = ANY (ARRAY['CHASE'::text, 'SHAPE'::text, 'MONITOR'::text, 'AVOID'::text, 
                              'HIGH_PRIORITY'::text, 'WATCH'::text, 'INFO_ONLY'::text, 'OUT_OF_SCOPE'::text, 'REVIEW'::text]));