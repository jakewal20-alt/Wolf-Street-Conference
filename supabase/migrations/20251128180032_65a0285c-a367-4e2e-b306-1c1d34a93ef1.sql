-- Add company profile table for AI analysis
CREATE TABLE IF NOT EXISTS public.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_customers TEXT[] DEFAULT '{}',
  contract_vehicles TEXT[] DEFAULT '{}',
  set_asides TEXT[] DEFAULT '{}',
  past_performance_areas TEXT[] DEFAULT '{}',
  target_agencies TEXT[] DEFAULT '{}',
  technical_expertise TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own company profile"
  ON public.company_profile
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add AI scoring fields to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS ai_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_recommendation_reason TEXT,
  ADD COLUMN IF NOT EXISTS customer_alignment_score INTEGER,
  ADD COLUMN IF NOT EXISTS technical_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS contract_vehicle_score INTEGER,
  ADD COLUMN IF NOT EXISTS win_probability_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMP WITH TIME ZONE;

-- Update trigger for company_profile
CREATE TRIGGER update_company_profile_updated_at
  BEFORE UPDATE ON public.company_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();