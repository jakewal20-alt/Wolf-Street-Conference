-- Drop the existing check constraint
ALTER TABLE public.knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;

-- Recreate with additional allowed source types for brain references
ALTER TABLE public.knowledge_base ADD CONSTRAINT knowledge_base_source_type_check 
CHECK (source_type = ANY (ARRAY[
  'youtube'::text, 
  'publication'::text, 
  'podcast'::text, 
  'hatch'::text, 
  'defense_contract'::text, 
  'sam'::text, 
  'linkedin'::text, 
  'newsletter'::text,
  'brain_reference'::text,
  'company_profile'::text,
  'exemplar'::text,
  'user_upload'::text
]));