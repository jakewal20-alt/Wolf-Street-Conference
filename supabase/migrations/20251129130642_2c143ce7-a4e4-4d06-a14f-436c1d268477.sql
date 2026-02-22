-- ================================================
-- Step 1: Add opportunity_id to bd_opportunities
-- ================================================

-- Add the foreign key column (nullable for now, will backfill)
ALTER TABLE public.bd_opportunities 
ADD COLUMN opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_bd_opportunities_opportunity_id ON public.bd_opportunities(opportunity_id);

-- ================================================
-- Step 2: Backfill opportunity_id for existing rows
-- ================================================

-- Match by title similarity (case-insensitive)
-- This handles most cases where names are similar
UPDATE public.bd_opportunities bd
SET opportunity_id = (
  SELECT o.id
  FROM public.opportunities o
  WHERE LOWER(o.title) LIKE '%' || LOWER(COALESCE(bd.short_name, bd.name)) || '%'
     OR LOWER(COALESCE(bd.short_name, bd.name)) LIKE '%' || LOWER(o.title) || '%'
  LIMIT 1
)
WHERE bd.opportunity_id IS NULL;

-- ================================================
-- Step 3: Add opportunity_id to bd_opportunity_status (denormalized)
-- ================================================

-- Add denormalized opportunity_id column for easier querying
ALTER TABLE public.bd_opportunity_status 
ADD COLUMN linked_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

-- Backfill from parent bd_opportunities
UPDATE public.bd_opportunity_status bos
SET linked_opportunity_id = (
  SELECT bd.opportunity_id
  FROM public.bd_opportunities bd
  WHERE bd.id = bos.opportunity_id
)
WHERE bos.linked_opportunity_id IS NULL;

-- Create index for performance
CREATE INDEX idx_bd_opportunity_status_linked_opportunity_id ON public.bd_opportunity_status(linked_opportunity_id);

-- ================================================
-- Comments for documentation
-- ================================================

COMMENT ON COLUMN public.bd_opportunities.opportunity_id IS 'Links to canonical opportunity in public.opportunities table';
COMMENT ON COLUMN public.bd_opportunity_status.linked_opportunity_id IS 'Denormalized link to public.opportunities for easier querying of latest status';