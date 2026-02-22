-- Create document_shares table for sharing documents with team members
CREATE TABLE public.document_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.saved_documents(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  shared_with UUID NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_shared_by FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_shared_with FOREIGN KEY (shared_with) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(document_id, shared_with)
);

-- Enable RLS
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Policies for document_shares
CREATE POLICY "Users can view shares where they are involved"
ON public.document_shares
FOR SELECT
USING (auth.uid() = shared_by OR auth.uid() = shared_with);

CREATE POLICY "Document owners can create shares"
ON public.document_shares
FOR INSERT
WITH CHECK (
  auth.uid() = shared_by AND
  EXISTS (
    SELECT 1 FROM public.saved_documents
    WHERE id = document_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Sharers can delete their shares"
ON public.document_shares
FOR DELETE
USING (auth.uid() = shared_by);

-- Update saved_documents policies to include shared documents
CREATE POLICY "Users can view documents shared with them"
ON public.saved_documents
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.document_shares
    WHERE document_id = saved_documents.id
    AND shared_with = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_document_shares_document_id ON public.document_shares(document_id);
CREATE INDEX idx_document_shares_shared_with ON public.document_shares(shared_with);