-- Add AI company fit score column to contract_awards
ALTER TABLE public.contract_awards 
ADD COLUMN IF NOT EXISTS ai_company_fit_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_company_fit_reason text DEFAULT NULL;