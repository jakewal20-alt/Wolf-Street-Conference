-- Add URL ingestion columns to conferences table
ALTER TABLE public.conferences
ADD COLUMN source_url text,
ADD COLUMN website_data jsonb;

-- Create index for faster lookups by URL
CREATE INDEX idx_conferences_source_url ON public.conferences(source_url);

-- Add comments
COMMENT ON COLUMN public.conferences.source_url IS 'Main conference website URL for auto-ingestion';
COMMENT ON COLUMN public.conferences.website_data IS 'Raw parsed metadata snapshot from website';