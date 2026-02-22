-- Add AI briefing columns to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN ai_brief jsonb,
ADD COLUMN ai_brief_updated_at timestamptz;

-- Add index for quick lookup of stale briefs
CREATE INDEX idx_opportunities_ai_brief_updated ON public.opportunities(ai_brief_updated_at)
WHERE ai_brief_updated_at IS NOT NULL;