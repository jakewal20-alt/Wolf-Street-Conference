-- Create ai_feedback table to track user feedback on opportunities
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.ai_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.ai_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON public.ai_feedback
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created_at ON public.ai_feedback(created_at);
CREATE INDEX idx_ai_feedback_type ON public.ai_feedback(feedback_type);

-- Create persona_weightings table to store learned tag weightings
CREATE TABLE public.persona_weightings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tag_weightings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_trained_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  training_data_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.persona_weightings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own persona weightings
CREATE POLICY "Users can manage their own persona weightings"
ON public.persona_weightings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_persona_weightings_user_id ON public.persona_weightings(user_id);