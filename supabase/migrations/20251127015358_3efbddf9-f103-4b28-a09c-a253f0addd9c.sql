-- Rename search_criteria to hunts for better terminology
ALTER TABLE public.search_criteria RENAME TO hunts;

-- Add description field to hunts
ALTER TABLE public.hunts ADD COLUMN description TEXT;

-- Create junction table for opportunity-hunt relationships
CREATE TABLE public.opportunity_hunts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  hunt_id UUID NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, hunt_id)
);

-- Enable RLS
ALTER TABLE public.opportunity_hunts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunity_hunts
CREATE POLICY "Users can view opportunity hunts for their opportunities"
ON public.opportunity_hunts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_hunts.opportunity_id
    AND opportunities.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert opportunity hunts"
ON public.opportunity_hunts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete opportunity hunts for their opportunities"
ON public.opportunity_hunts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_hunts.opportunity_id
    AND opportunities.user_id = auth.uid()
  )
);