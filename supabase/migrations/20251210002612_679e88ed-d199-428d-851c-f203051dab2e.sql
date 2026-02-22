-- Drop the old status check constraint and replace with one matching the Kanban stages
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_status_check 
CHECK (status = ANY (ARRAY['New'::text, 'Pursuing'::text, 'Bidding'::text, 'Submitted'::text, 'Won'::text, 'Lost'::text, 'In Review'::text, 'Active Capture'::text, 'Closed'::text]));