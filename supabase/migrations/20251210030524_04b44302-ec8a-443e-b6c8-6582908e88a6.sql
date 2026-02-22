-- Add folder column to documents table for organizing company documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT NULL;

-- Create an index for faster folder queries
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder);
