-- Add multi-source fields to opportunities table
-- These fields track where each opportunity came from and support multiple external providers

-- Add source_provider to track which provider the opportunity came from
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'sam_gov';

-- Add external_id to store provider-specific ID (SAM Notice ID, aggregator internal ID, etc.)
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_id text NULL;

-- Add external_url to store the canonical URL to the opportunity page
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_url text NULL;

-- Add external_metadata to store arbitrary metadata from the provider
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_metadata jsonb NULL DEFAULT '{}'::jsonb;

-- Add last_refreshed_at to track when the opportunity was last refreshed from source
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp with time zone NULL;

-- Create an index on source_provider for efficient filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_source_provider ON public.opportunities(source_provider);

-- Create an index on external_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_external_id ON public.opportunities(external_id);

-- Add a comment explaining the source_provider values
COMMENT ON COLUMN public.opportunities.source_provider IS 'Provider source: sam_gov, samsearch, govwin, govtribe, govspend, manual, other_url';