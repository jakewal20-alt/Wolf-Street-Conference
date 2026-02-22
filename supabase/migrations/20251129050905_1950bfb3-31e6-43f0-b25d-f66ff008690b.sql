-- Enable realtime for reference_documents table so frontend can receive updates
-- when attachments are downloaded in background
ALTER PUBLICATION supabase_realtime ADD TABLE public.reference_documents;