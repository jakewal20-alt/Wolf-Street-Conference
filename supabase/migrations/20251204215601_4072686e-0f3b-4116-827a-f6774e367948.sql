-- Create contract_awards table for USAspending and future FPDS data
CREATE TABLE public.contract_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- External identifiers
  award_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'usaspending', -- usaspending, fpds, sam_contract
  
  -- Award details
  recipient_name TEXT NOT NULL,
  recipient_uei TEXT,
  recipient_duns TEXT,
  award_amount NUMERIC,
  total_obligation NUMERIC,
  
  -- Dates
  award_date DATE,
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  
  -- Agency info
  awarding_agency TEXT,
  awarding_sub_agency TEXT,
  funding_agency TEXT,
  
  -- Classification
  naics_code TEXT,
  naics_description TEXT,
  psc_code TEXT,
  psc_description TEXT,
  
  -- Set-aside and contract type
  set_aside_type TEXT,
  set_aside_description TEXT,
  contract_type TEXT,
  
  -- Location
  place_of_performance_city TEXT,
  place_of_performance_state TEXT,
  place_of_performance_country TEXT,
  
  -- Description
  award_description TEXT,
  
  -- Subcontract lead scoring (0-100)
  subcontract_lead_score INTEGER DEFAULT 0,
  subcontract_lead_reason TEXT,
  
  -- Watchlist
  is_watchlisted BOOLEAN DEFAULT false,
  watchlist_notes TEXT,
  
  -- Metadata
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint on source + award_id per user
  UNIQUE(user_id, source, award_id)
);

-- Enable RLS
ALTER TABLE public.contract_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own contract awards"
  ON public.contract_awards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contract awards"
  ON public.contract_awards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contract awards"
  ON public.contract_awards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contract awards"
  ON public.contract_awards FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX idx_contract_awards_user_id ON public.contract_awards(user_id);
CREATE INDEX idx_contract_awards_source ON public.contract_awards(source);
CREATE INDEX idx_contract_awards_naics ON public.contract_awards(naics_code);
CREATE INDEX idx_contract_awards_award_date ON public.contract_awards(award_date DESC);
CREATE INDEX idx_contract_awards_subcontract_score ON public.contract_awards(subcontract_lead_score DESC);
CREATE INDEX idx_contract_awards_watchlist ON public.contract_awards(user_id, is_watchlisted) WHERE is_watchlisted = true;

-- Trigger for updated_at
CREATE TRIGGER update_contract_awards_updated_at
  BEFORE UPDATE ON public.contract_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create sync_logs table for tracking sync history
CREATE TABLE public.usaspending_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL, -- 'full', 'incremental'
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  awards_fetched INTEGER DEFAULT 0,
  awards_inserted INTEGER DEFAULT 0,
  awards_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.usaspending_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sync logs"
  ON public.usaspending_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert sync logs"
  ON public.usaspending_sync_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);