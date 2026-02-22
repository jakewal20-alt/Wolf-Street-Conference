-- Create SAM.gov job queue table for background processing
CREATE TABLE public.sam_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'notice_refresh', 'search_prefetch'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'done', 'error'
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_job_queue ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view queue (admin monitoring)
CREATE POLICY "Authenticated users can view job queue"
  ON public.sam_job_queue
  FOR SELECT
  USING (true);

-- Index for efficient job polling
CREATE INDEX idx_sam_job_queue_status_next_run ON public.sam_job_queue (status, next_run_at)
  WHERE status = 'pending';

-- Index for cleanup queries
CREATE INDEX idx_sam_job_queue_created_at ON public.sam_job_queue (created_at);

-- Trigger for updated_at
CREATE TRIGGER update_sam_job_queue_updated_at
  BEFORE UPDATE ON public.sam_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();