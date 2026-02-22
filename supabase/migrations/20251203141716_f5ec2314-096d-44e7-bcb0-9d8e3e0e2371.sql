-- Add enrichment fields to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS description_raw text,
ADD COLUMN IF NOT EXISTS description_enriched text,
ADD COLUMN IF NOT EXISTS description_source text DEFAULT 'sam_api',
ADD COLUMN IF NOT EXISTS last_enriched_at timestamp with time zone;

-- Add check constraint for description_source
ALTER TABLE public.opportunities
ADD CONSTRAINT check_description_source 
CHECK (description_source IS NULL OR description_source IN ('sam_api', 'sam_scrape', 'web_scrape'));

-- Create index for finding opportunities needing enrichment
CREATE INDEX IF NOT EXISTS idx_opportunities_needs_enrichment 
ON public.opportunities (created_at, last_enriched_at) 
WHERE (description_raw IS NULL OR length(description_raw) < 50);