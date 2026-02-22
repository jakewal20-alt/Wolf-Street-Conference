-- Create table for caching SAM.gov search results
CREATE TABLE public.sam_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_hash TEXT NOT NULL UNIQUE,
  search_criteria JSONB NOT NULL,
  results JSONB NOT NULL,
  total_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  user_id UUID NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_sam_search_cache_hash ON public.sam_search_cache(search_hash);
CREATE INDEX idx_sam_search_cache_expires ON public.sam_search_cache(expires_at);
CREATE INDEX idx_sam_search_cache_user ON public.sam_search_cache(user_id);

-- Enable RLS
ALTER TABLE public.sam_search_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cached searches
CREATE POLICY "Users can view their own cached searches"
  ON public.sam_search_cache
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cached searches
CREATE POLICY "Users can insert their own cached searches"
  ON public.sam_search_cache
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cached searches
CREATE POLICY "Users can delete their own cached searches"
  ON public.sam_search_cache
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to clean up expired cache entries (can be called by a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sam_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.sam_search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE public.sam_search_cache IS 'Caches SAM.gov search results to reduce API calls. Entries expire after 24 hours.';