-- Create meeting_pipelines table
CREATE TABLE public.meeting_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  meeting_date DATE,
  transcript_source TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  share_token UUID DEFAULT gen_random_uuid(),
  is_public BOOLEAN DEFAULT false
);

-- Create meeting_pipeline_items table
CREATE TABLE public.meeting_pipeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.meeting_pipelines(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  title TEXT NOT NULL,
  short_summary TEXT,
  owner TEXT,
  urgency_level TEXT,
  time_horizon TEXT,
  status_tag TEXT DEFAULT 'Gray',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_pipeline_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_pipelines
CREATE POLICY "Users can manage their own meeting pipelines"
  ON public.meeting_pipelines
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public pipelines are viewable by anyone with share token"
  ON public.meeting_pipelines
  FOR SELECT
  USING (is_public = true);

-- RLS policies for meeting_pipeline_items
CREATE POLICY "Users can manage items in their pipelines"
  ON public.meeting_pipeline_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Items in public pipelines are viewable by anyone"
  ON public.meeting_pipeline_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.is_public = true
    )
  );

-- Create indexes
CREATE INDEX idx_meeting_pipeline_items_pipeline_id ON public.meeting_pipeline_items(pipeline_id);
CREATE INDEX idx_meeting_pipeline_items_stage ON public.meeting_pipeline_items(stage_name);
CREATE INDEX idx_meeting_pipelines_share_token ON public.meeting_pipelines(share_token);

-- Add trigger for updated_at
CREATE TRIGGER update_meeting_pipelines_updated_at
  BEFORE UPDATE ON public.meeting_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_pipeline_items_updated_at
  BEFORE UPDATE ON public.meeting_pipeline_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for transcripts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meeting-transcripts', 'meeting-transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own transcripts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own transcripts"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own transcripts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );