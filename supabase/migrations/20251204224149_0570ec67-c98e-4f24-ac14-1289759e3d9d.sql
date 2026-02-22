-- PHASE 2: Contacts and Touchpoints tables

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  org_name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contacts
CREATE POLICY "Users can manage their own contacts"
  ON public.contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Touchpoints table
CREATE TABLE public.touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  related_type TEXT,
  related_id UUID,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.touchpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for touchpoints
CREATE POLICY "Users can manage their own touchpoints"
  ON public.touchpoints
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_org_name ON public.contacts(org_name);
CREATE INDEX idx_touchpoints_user_id ON public.touchpoints(user_id);
CREATE INDEX idx_touchpoints_contact_id ON public.touchpoints(contact_id);
CREATE INDEX idx_touchpoints_related ON public.touchpoints(related_type, related_id);
CREATE INDEX idx_touchpoints_date ON public.touchpoints(date DESC);

-- Update trigger for contacts
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for touchpoints
CREATE TRIGGER update_touchpoints_updated_at
  BEFORE UPDATE ON public.touchpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- PHASE 4: SLED scaffolding - Add level column to opportunities and contract_awards

-- Add level to opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'federal';

-- Add level to contract_awards
ALTER TABLE public.contract_awards 
ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'federal';

-- Indexes for level filtering
CREATE INDEX idx_opportunities_level ON public.opportunities(level);
CREATE INDEX idx_contract_awards_level ON public.contract_awards(level);