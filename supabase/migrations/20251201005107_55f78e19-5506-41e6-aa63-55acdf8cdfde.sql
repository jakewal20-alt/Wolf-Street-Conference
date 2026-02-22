-- Add front_end_solutioning field to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN front_end_solutioning boolean DEFAULT false;

-- Create index for filtering
CREATE INDEX idx_opportunities_front_end_solutioning 
ON public.opportunities(front_end_solutioning) 
WHERE front_end_solutioning = true;