-- Create documents table for company knowledge management
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('capability', 'proposal', 'white_paper', 'sow', 'slide_deck', 'other')),
  tags TEXT[] DEFAULT '{}',
  file_size BIGINT,
  processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'failed')),
  knowledge_base_id UUID REFERENCES public.knowledge_base(id),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunity_documents linking table
CREATE TABLE IF NOT EXISTS public.opportunity_documents_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  linked_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(opportunity_id, document_id)
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_documents_link ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for opportunity_documents_link
CREATE POLICY "Users can view links for their opportunities"
  ON public.opportunity_documents_link FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.id = opportunity_documents_link.opportunity_id
      AND opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create links for their opportunities"
  ON public.opportunity_documents_link FOR INSERT
  WITH CHECK (
    auth.uid() = linked_by
    AND EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.id = opportunity_documents_link.opportunity_id
      AND opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete links for their opportunities"
  ON public.opportunity_documents_link FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.id = opportunity_documents_link.opportunity_id
      AND opportunities.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);
CREATE INDEX idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX idx_opportunity_documents_link_opp_id ON public.opportunity_documents_link(opportunity_id);
CREATE INDEX idx_opportunity_documents_link_doc_id ON public.opportunity_documents_link(document_id);

-- Trigger to update updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment usage count when document is linked
CREATE OR REPLACE FUNCTION public.increment_document_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.documents
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_document_usage_on_link
  AFTER INSERT ON public.opportunity_documents_link
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_document_usage();