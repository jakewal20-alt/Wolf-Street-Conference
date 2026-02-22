-- BD Meeting Pipeline - completely separate from main opportunities
-- Stores weekly meeting transcript snapshots
CREATE TABLE public.bd_meeting_pipeline_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_date DATE NOT NULL,
  week_start DATE NOT NULL, -- Always Sunday of that week
  title TEXT NOT NULL,
  raw_transcript TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Items extracted from meeting transcripts
CREATE TABLE public.bd_meeting_pipeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.bd_meeting_pipeline_snapshots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer TEXT,
  stage TEXT NOT NULL DEFAULT 'STAGE_0', -- STAGE_0, STAGE_1, STAGE_2, STAGE_3, BIN, ARCHIVED
  owner TEXT,
  next_action TEXT,
  next_action_due DATE,
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  value_estimate NUMERIC,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bd_meeting_pipeline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_meeting_pipeline_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snapshots
CREATE POLICY "Users can view their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for items (via snapshot ownership)
CREATE POLICY "Users can view items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_bd_snapshots_user_week ON public.bd_meeting_pipeline_snapshots(user_id, week_start);
CREATE INDEX idx_bd_items_snapshot ON public.bd_meeting_pipeline_items(snapshot_id);
CREATE INDEX idx_bd_items_stage ON public.bd_meeting_pipeline_items(stage);

-- Update trigger for updated_at
CREATE TRIGGER update_bd_snapshots_updated_at
BEFORE UPDATE ON public.bd_meeting_pipeline_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_items_updated_at
BEFORE UPDATE ON public.bd_meeting_pipeline_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();