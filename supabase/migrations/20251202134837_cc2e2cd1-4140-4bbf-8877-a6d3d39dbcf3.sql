-- First, drop the existing check constraint and create a new one that includes 'needs_description'
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_status_check;

-- Add the new check constraint with 'needs_description' as a valid value
ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_ai_status_check 
CHECK (ai_status IN ('pending', 'ok', 'error', 'needs_description'));