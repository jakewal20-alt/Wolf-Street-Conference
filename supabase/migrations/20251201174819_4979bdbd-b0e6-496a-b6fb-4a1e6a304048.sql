-- Add sam_last_refreshed_at column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS sam_last_refreshed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.opportunities.sam_last_refreshed_at IS 'Timestamp of the last successful refresh from SAM.gov API for this opportunity';