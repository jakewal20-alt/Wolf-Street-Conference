-- Create BD Library table for saved pipeline items
CREATE TABLE public.bd_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  short_summary TEXT,
  owner TEXT,
  time_horizon TEXT,
  status_tag TEXT DEFAULT 'Gray',
  urgency_level TEXT,
  notes TEXT,
  source_pipeline_id UUID REFERENCES public.meeting_pipelines(id) ON DELETE SET NULL,
  source_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bd_library ENABLE ROW LEVEL SECURITY;

-- Users can manage their own library items
CREATE POLICY "Users can manage their own library items"
ON public.bd_library
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view shared library items
CREATE POLICY "Users can view shared library items"
ON public.bd_library
FOR SELECT
USING (has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Create trigger for updated_at
CREATE TRIGGER update_bd_library_updated_at
BEFORE UPDATE ON public.bd_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();