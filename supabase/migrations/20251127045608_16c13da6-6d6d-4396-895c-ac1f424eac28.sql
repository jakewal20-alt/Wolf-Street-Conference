-- Create junction table to link capabilities with reference documents
CREATE TABLE capability_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid NOT NULL REFERENCES company_capabilities(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES reference_documents(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(capability_id, document_id)
);

-- Enable RLS
ALTER TABLE capability_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for capability_documents
CREATE POLICY "Users can view their capability documents"
ON capability_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_capabilities
    WHERE company_capabilities.id = capability_documents.capability_id
    AND company_capabilities.user_id = auth.uid()
  )
);

CREATE POLICY "Users can link documents to their capabilities"
ON capability_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_capabilities
    WHERE company_capabilities.id = capability_documents.capability_id
    AND company_capabilities.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM reference_documents
    WHERE reference_documents.id = capability_documents.document_id
    AND reference_documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can unlink documents from their capabilities"
ON capability_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_capabilities
    WHERE company_capabilities.id = capability_documents.capability_id
    AND company_capabilities.user_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_capability_documents_capability_id ON capability_documents(capability_id);
CREATE INDEX idx_capability_documents_document_id ON capability_documents(document_id);