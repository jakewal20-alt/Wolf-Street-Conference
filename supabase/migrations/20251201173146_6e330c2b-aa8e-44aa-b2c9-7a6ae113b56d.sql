-- Add sam_last_refreshed_at timestamp to track when SAM data was last refreshed
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS sam_last_refreshed_at timestamptz DEFAULT NULL;