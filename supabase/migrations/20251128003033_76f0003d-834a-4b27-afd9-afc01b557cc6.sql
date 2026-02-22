-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS "Users can upload reference documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own reference documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own reference documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own reference documents" ON storage.objects;

-- Policy: Users can upload files to reference-documents bucket
CREATE POLICY "Users can upload reference documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reference-documents'
);

-- Policy: Users can view files in reference-documents bucket
CREATE POLICY "Users can view their own reference documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reference-documents'
);

-- Policy: Users can update files in reference-documents bucket
CREATE POLICY "Users can update their own reference documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reference-documents'
);

-- Policy: Users can delete files in reference-documents bucket
CREATE POLICY "Users can delete their own reference documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reference-documents'
);