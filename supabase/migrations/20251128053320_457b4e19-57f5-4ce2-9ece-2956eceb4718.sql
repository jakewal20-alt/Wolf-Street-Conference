-- Create company status board table for tracking all company opportunities
CREATE TABLE public.company_status_board (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_name TEXT NOT NULL,
  short_name TEXT,
  status_summary TEXT,
  health TEXT DEFAULT 'none',
  owner TEXT,
  due_date DATE,
  category TEXT, -- pipeline, stage0, stage1, white_paper, cso, long_range
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  week_of DATE NOT NULL,
  source_transcript_id UUID,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_status_board ENABLE ROW LEVEL SECURITY;

-- Policies for company status board
CREATE POLICY "Users can view all company status entries"
  ON public.company_status_board
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their company status entries"
  ON public.company_status_board
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_company_status_board_updated_at
  BEFORE UPDATE ON public.company_status_board
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for company status transcripts
CREATE TABLE public.company_status_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_of DATE NOT NULL,
  raw_text TEXT NOT NULL,
  label TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_status_transcripts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view company transcripts"
  ON public.company_status_transcripts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their company transcripts"
  ON public.company_status_transcripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);