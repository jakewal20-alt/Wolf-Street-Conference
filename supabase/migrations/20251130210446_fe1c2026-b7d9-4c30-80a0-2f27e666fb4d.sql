-- Add AI status tracking fields to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending' CHECK (ai_status IN ('ok', 'pending', 'error')),
ADD COLUMN IF NOT EXISTS ai_error_message text;

-- Update existing opportunities with scores to have ai_status = 'ok'
UPDATE public.opportunities
SET ai_status = 'ok'
WHERE ai_fit_score IS NOT NULL AND ai_scored_at IS NOT NULL;

-- Update existing opportunities with errors in ai_reason to have ai_status = 'error'
UPDATE public.opportunities
SET ai_status = 'error',
    ai_error_message = ai_reason
WHERE ai_reason LIKE '%AI error:%' OR ai_reason LIKE '%error%' OR ai_reason LIKE '%Empty JSON%';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_ai_status ON public.opportunities(ai_status);

COMMENT ON COLUMN public.opportunities.ai_status IS 'AI scoring status: ok (successfully scored), pending (not yet scored), error (scoring failed)';
COMMENT ON COLUMN public.opportunities.ai_error_message IS 'Detailed error message if AI scoring failed';