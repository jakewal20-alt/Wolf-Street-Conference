-- Create bd_opportunities table (distinct from existing opportunities table)
CREATE TABLE IF NOT EXISTS public.bd_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('pipeline', 'stage0', 'stage1', 'white_paper', 'cso', 'long_range')),
  owner TEXT,
  supporting_owners TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'watch', 'closed', 'no_go')),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bd_transcripts table
CREATE TABLE IF NOT EXISTS public.bd_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of DATE NOT NULL,
  label TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bd_opportunity_status table (weekly snapshots)
CREATE TABLE IF NOT EXISTS public.bd_opportunity_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('0_30', '31_60', 'gt_60', 'long_range', 'n_a')),
  health TEXT NOT NULL CHECK (health IN ('green', 'yellow', 'orange', 'red', 'none')),
  summary TEXT,
  raw_notes TEXT,
  due_date DATE,
  flags JSONB DEFAULT '{}',
  source_transcript_id UUID REFERENCES public.bd_transcripts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, week_of)
);

-- Enable RLS
ALTER TABLE public.bd_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_opportunity_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for bd_opportunities
CREATE POLICY "Users can manage their BD opportunities"
  ON public.bd_opportunities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for bd_transcripts
CREATE POLICY "Users can manage their BD transcripts"
  ON public.bd_transcripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for bd_opportunity_status
CREATE POLICY "Users can view BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_bd_opportunities_user_id ON public.bd_opportunities(user_id);
CREATE INDEX idx_bd_transcripts_user_id ON public.bd_transcripts(user_id);
CREATE INDEX idx_bd_transcripts_week_of ON public.bd_transcripts(week_of);
CREATE INDEX idx_bd_opportunity_status_opportunity_id ON public.bd_opportunity_status(opportunity_id);
CREATE INDEX idx_bd_opportunity_status_week_of ON public.bd_opportunity_status(week_of);

-- Trigger to update updated_at
CREATE TRIGGER update_bd_opportunities_updated_at
  BEFORE UPDATE ON public.bd_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_opportunity_status_updated_at
  BEFORE UPDATE ON public.bd_opportunity_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();