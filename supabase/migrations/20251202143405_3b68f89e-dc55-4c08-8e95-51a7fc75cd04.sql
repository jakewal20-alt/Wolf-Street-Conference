-- Create SAM.gov sync logs table for monitoring
CREATE TABLE IF NOT EXISTS public.sam_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'nightly_refresh', 'manual_refresh', 'search'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_sam_calls INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  opportunities_refreshed INTEGER DEFAULT 0,
  scoring_tasks_triggered INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read logs (for admin panel)
CREATE POLICY "Authenticated users can view sync logs"
  ON public.sam_sync_logs FOR SELECT
  TO authenticated
  USING (true);

-- Index for querying recent logs
CREATE INDEX idx_sam_sync_logs_started_at ON public.sam_sync_logs(started_at DESC);
CREATE INDEX idx_sam_sync_logs_sync_type ON public.sam_sync_logs(sync_type);