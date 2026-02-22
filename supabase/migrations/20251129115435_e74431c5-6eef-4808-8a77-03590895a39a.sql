-- Create table for DoD contract awards
CREATE TABLE public.dod_contract_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_date DATE NOT NULL,
  announcement_date DATE NOT NULL,
  prime_contractor TEXT NOT NULL,
  location TEXT,
  contract_value NUMERIC,
  contract_value_text TEXT,
  service_branch TEXT NOT NULL,
  description TEXT NOT NULL,
  place_of_performance TEXT,
  contract_number TEXT,
  tags TEXT[] DEFAULT '{}',
  relevance_score INTEGER,
  ai_summary TEXT,
  technology_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX idx_dod_contracts_date ON public.dod_contract_awards(announcement_date DESC);
CREATE INDEX idx_dod_contracts_branch ON public.dod_contract_awards(service_branch);
CREATE INDEX idx_dod_contracts_contractor ON public.dod_contract_awards(prime_contractor);
CREATE INDEX idx_dod_contracts_tags ON public.dod_contract_awards USING GIN(tags);

-- Enable RLS
ALTER TABLE public.dod_contract_awards ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view contract awards
CREATE POLICY "Contract awards are viewable by authenticated users"
  ON public.dod_contract_awards
  FOR SELECT
  TO authenticated
  USING (true);

-- Create table for user contract watchlist
CREATE TABLE public.user_contract_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  notify_on_match BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contractor_name)
);

-- Enable RLS for watchlist
ALTER TABLE public.user_contract_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can manage their own watchlist
CREATE POLICY "Users can manage their own watchlist"
  ON public.user_contract_watchlist
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update trigger for contract awards
CREATE TRIGGER update_dod_contract_awards_updated_at
  BEFORE UPDATE ON public.dod_contract_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();