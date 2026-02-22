-- Create storage bucket for reference documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reference-documents',
  'reference-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']
);

-- RLS policies for reference documents bucket
CREATE POLICY "Users can upload their own reference documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reference-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own reference documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reference-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own reference documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reference-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own reference documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reference-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add storage_path column to reference_documents table
ALTER TABLE reference_documents
ADD COLUMN storage_path text;