-- Create table for user's reference documents (PWS, capabilities, past projects)
CREATE TABLE IF NOT EXISTS public.reference_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'pws', 'capabilities_statement', 'past_project', 'technical_approach'
  content TEXT NOT NULL,
  parsed_data JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reference_documents_user_id ON public.reference_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_documents_active ON public.reference_documents(user_id, active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.reference_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own reference documents" 
ON public.reference_documents 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_reference_documents_updated_at
BEFORE UPDATE ON public.reference_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();