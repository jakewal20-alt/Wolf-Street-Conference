-- Add source_text column to store the transcript excerpt that the AI used for each item
ALTER TABLE public.bd_meeting_pipeline_items 
ADD COLUMN IF NOT EXISTS source_text text;