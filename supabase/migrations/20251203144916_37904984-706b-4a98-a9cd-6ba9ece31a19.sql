-- Create proposal_ai_events table to log all AI actions
CREATE TABLE public.proposal_ai_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'generate_outline', 'generate_proposal', 'fact_check', 'compliance_check', 'evaluation', 'copilot_chat'
  model_version TEXT NOT NULL, -- 'gpt-5-2025-08-07', etc.
  writing_mode TEXT, -- 'government_formal', 'executive_summary', 'technical_volume', 'capability_statement'
  input_context JSONB DEFAULT '{}'::jsonb, -- RAG sources used, parameters
  output_summary TEXT, -- Brief summary of output
  output_data JSONB DEFAULT '{}'::jsonb, -- Full structured output
  token_usage JSONB DEFAULT '{}'::jsonb, -- prompt_tokens, completion_tokens
  duration_ms INTEGER, -- Processing time
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_ai_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view their own proposal AI events"
  ON public.proposal_ai_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY "Users can insert their own proposal AI events"
  ON public.proposal_ai_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_proposal_ai_events_user_id ON public.proposal_ai_events(user_id);
CREATE INDEX idx_proposal_ai_events_opportunity_id ON public.proposal_ai_events(opportunity_id);
CREATE INDEX idx_proposal_ai_events_created_at ON public.proposal_ai_events(created_at DESC);