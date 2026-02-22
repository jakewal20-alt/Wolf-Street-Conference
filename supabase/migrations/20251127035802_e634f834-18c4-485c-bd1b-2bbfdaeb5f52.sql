-- Create saved_documents table
CREATE TABLE public.saved_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.saved_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own saved documents"
ON public.saved_documents
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved documents"
ON public.saved_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved documents"
ON public.saved_documents
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved documents"
ON public.saved_documents
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_saved_documents_user_id ON public.saved_documents(user_id);
CREATE INDEX idx_saved_documents_created_at ON public.saved_documents(created_at DESC);
CREATE INDEX idx_saved_documents_tags ON public.saved_documents USING GIN(tags);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_documents_updated_at
BEFORE UPDATE ON public.saved_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();