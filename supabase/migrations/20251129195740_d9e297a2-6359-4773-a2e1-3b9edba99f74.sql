-- Add is_user_pursuit column to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS is_user_pursuit boolean NOT NULL DEFAULT false;

-- Add created_by column to track who created the opportunity
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create opportunity_documents table for uploaded RFP files
CREATE TABLE IF NOT EXISTS public.opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS on opportunity_documents
ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunity_documents
CREATE POLICY "Users can view their own opportunity documents"
ON public.opportunity_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own opportunity documents"
ON public.opportunity_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opportunity documents"
ON public.opportunity_documents FOR DELETE
USING (auth.uid() = user_id);

-- Create pursuit_docs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pursuit_docs', 'pursuit_docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pursuit_docs bucket
CREATE POLICY "Users can upload their own pursuit documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pursuit_docs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own pursuit documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pursuit_docs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own pursuit documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pursuit_docs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Backfill known pursuits with is_user_pursuit = true
UPDATE public.opportunities
SET is_user_pursuit = true
WHERE title ILIKE '%ARES%'
   OR title ILIKE '%WARMIX%'
   OR title ILIKE '%ATM%'
   OR title ILIKE '%IBCS%'
   OR title ILIKE '%GROMMET%';

-- Create index for faster queries on is_user_pursuit
CREATE INDEX IF NOT EXISTS idx_opportunities_is_user_pursuit 
ON public.opportunities(is_user_pursuit) 
WHERE is_user_pursuit = true;