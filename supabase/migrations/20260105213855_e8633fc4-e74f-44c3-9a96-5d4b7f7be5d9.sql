-- Add archived column to conferences table
ALTER TABLE public.conferences 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX idx_conferences_archived ON public.conferences(archived);