-- Add unique constraint for upsert to work
ALTER TABLE public.contract_awards 
ADD CONSTRAINT contract_awards_user_source_award_unique 
UNIQUE (user_id, source, award_id);