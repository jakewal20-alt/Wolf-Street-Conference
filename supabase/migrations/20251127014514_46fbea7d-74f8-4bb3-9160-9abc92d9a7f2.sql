-- Create table for saved search criteria
CREATE TABLE public.search_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[],
  naics_codes TEXT[],
  set_aside_codes TEXT[],
  notice_types TEXT[],
  agencies TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own search criteria"
ON public.search_criteria
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search criteria"
ON public.search_criteria
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search criteria"
ON public.search_criteria
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search criteria"
ON public.search_criteria
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_search_criteria_updated_at
BEFORE UPDATE ON public.search_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track last sync time per user
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  opportunities_found INTEGER DEFAULT 0,
  opportunities_added INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sync logs"
ON public.sync_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs"
ON public.sync_logs
FOR INSERT
WITH CHECK (true);