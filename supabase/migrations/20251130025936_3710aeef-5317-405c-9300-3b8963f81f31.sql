-- Fix security warning: Set search_path for increment_document_usage function
DROP FUNCTION IF EXISTS public.increment_document_usage() CASCADE;

CREATE OR REPLACE FUNCTION public.increment_document_usage()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER increment_document_usage_on_link
  AFTER INSERT ON public.opportunity_documents_link
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_document_usage();