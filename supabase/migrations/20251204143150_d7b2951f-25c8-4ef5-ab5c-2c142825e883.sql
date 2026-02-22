-- Create table for proposal copilot chat history per opportunity
CREATE TABLE public.proposal_copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups by opportunity
CREATE INDEX idx_proposal_copilot_messages_opportunity ON public.proposal_copilot_messages(opportunity_id, created_at);

-- Enable RLS
ALTER TABLE public.proposal_copilot_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own copilot messages
CREATE POLICY "Users can view their own copilot messages"
ON public.proposal_copilot_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own copilot messages
CREATE POLICY "Users can insert their own copilot messages"
ON public.proposal_copilot_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own copilot messages
CREATE POLICY "Users can delete their own copilot messages"
ON public.proposal_copilot_messages
FOR DELETE
USING (auth.uid() = user_id);