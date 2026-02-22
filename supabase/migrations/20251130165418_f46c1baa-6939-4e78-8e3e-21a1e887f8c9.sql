-- Create conferences table
CREATE TABLE public.conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create conference_leads table
CREATE TABLE public.conference_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  ai_fit_score INTEGER,
  ai_reason TEXT,
  linked_opportunity_id UUID REFERENCES public.opportunities(id),
  card_image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conferences
CREATE POLICY "Users can view their own conferences"
  ON public.conferences FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own conferences"
  ON public.conferences FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own conferences"
  ON public.conferences FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own conferences"
  ON public.conferences FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for conference_leads
CREATE POLICY "Users can view their own conference leads"
  ON public.conference_leads FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own conference leads"
  ON public.conference_leads FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own conference leads"
  ON public.conference_leads FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own conference leads"
  ON public.conference_leads FOR DELETE
  USING (auth.uid() = created_by);

-- Create indexes for better query performance
CREATE INDEX idx_conferences_created_by ON public.conferences(created_by);
CREATE INDEX idx_conferences_dates ON public.conferences(start_date, end_date);
CREATE INDEX idx_conference_leads_conference_id ON public.conference_leads(conference_id);
CREATE INDEX idx_conference_leads_created_by ON public.conference_leads(created_by);
CREATE INDEX idx_conference_leads_status ON public.conference_leads(status);

-- Add trigger for updated_at
CREATE TRIGGER update_conferences_updated_at
  BEFORE UPDATE ON public.conferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conference_leads_updated_at
  BEFORE UPDATE ON public.conference_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();