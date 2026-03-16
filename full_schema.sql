-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  opportunity_number TEXT UNIQUE NOT NULL,
  type TEXT,
  synopsis TEXT,
  naics TEXT,
  posted_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  url TEXT,
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  recommended_action TEXT,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Review', 'Active Capture', 'Submitted', 'Closed')),
  ai_summary TEXT,
  ai_red_flags TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own opportunities"
  ON public.opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own opportunities"
  ON public.opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own opportunities"
  ON public.opportunities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opportunities"
  ON public.opportunities FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX idx_opportunities_due_date ON public.opportunities(due_date);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_opportunities_fit_score ON public.opportunities(fit_score);

-- Create chat conversations table
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  opportunity_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
        AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Fix search path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;-- Create table for saved search criteria
CREATE TABLE public.search_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[],
  naics_codes TEXT[],
  set_aside_codes TEXT[],
  notice_types TEXT[],
  agencies TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own search criteria"
ON public.search_criteria
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search criteria"
ON public.search_criteria
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search criteria"
ON public.search_criteria
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search criteria"
ON public.search_criteria
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_search_criteria_updated_at
BEFORE UPDATE ON public.search_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track last sync time per user
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  opportunities_found INTEGER DEFAULT 0,
  opportunities_added INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sync logs"
ON public.sync_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs"
ON public.sync_logs
FOR INSERT
WITH CHECK (true);-- Rename search_criteria to hunts for better terminology
ALTER TABLE public.search_criteria RENAME TO hunts;

-- Add description field to hunts
ALTER TABLE public.hunts ADD COLUMN description TEXT;

-- Create junction table for opportunity-hunt relationships
CREATE TABLE public.opportunity_hunts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  hunt_id UUID NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, hunt_id)
);

-- Enable RLS
ALTER TABLE public.opportunity_hunts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunity_hunts
CREATE POLICY "Users can view opportunity hunts for their opportunities"
ON public.opportunity_hunts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_hunts.opportunity_id
    AND opportunities.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert opportunity hunts"
ON public.opportunity_hunts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete opportunity hunts for their opportunities"
ON public.opportunity_hunts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.id = opportunity_hunts.opportunity_id
    AND opportunities.user_id = auth.uid()
  )
);-- Create meeting_notes table for tracking BD meeting notes
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE,
  attendees TEXT[],
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add deadline_alert field to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS deadline_alert TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_notes
CREATE POLICY "Users can view their own meeting notes"
  ON public.meeting_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meeting notes"
  ON public.meeting_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting notes"
  ON public.meeting_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting notes"
  ON public.meeting_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at on meeting_notes
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON public.meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add source field to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'SAM.gov';

-- Create table for Hatch Report issues
CREATE TABLE IF NOT EXISTS hatch_issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary_html TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Enable RLS on hatch_issues
ALTER TABLE hatch_issues ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read hatch issues
CREATE POLICY "Anyone can view hatch issues"
  ON hatch_issues
  FOR SELECT
  USING (true);

-- System can insert hatch issues
CREATE POLICY "System can insert hatch issues"
  ON hatch_issues
  FOR INSERT
  WITH CHECK (true);

-- System can update hatch issues
CREATE POLICY "System can update hatch issues"
  ON hatch_issues
  FOR UPDATE
  USING (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_hatch_published_at ON hatch_issues(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source);-- Create company capabilities profile table
CREATE TABLE IF NOT EXISTS company_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  capability_name TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_capabilities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their capabilities"
  ON company_capabilities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add AI analysis fields to opportunities
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS relevance_score INTEGER,
ADD COLUMN IF NOT EXISTS capability_matches TEXT[],
ADD COLUMN IF NOT EXISTS recommended_response_type TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;

-- Create index for relevance queries
CREATE INDEX IF NOT EXISTS idx_opportunities_relevance ON opportunities(relevance_score DESC, due_date ASC);

-- Add feedback tracking for learning
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS user_feedback TEXT,
ADD COLUMN IF NOT EXISTS pursuit_status TEXT DEFAULT 'pending';-- Create saved_documents table
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
EXECUTE FUNCTION public.update_updated_at_column();-- Create document_shares table for sharing documents with team members
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
CREATE INDEX idx_document_shares_shared_with ON public.document_shares(shared_with);-- Create federal_news table
CREATE TABLE IF NOT EXISTS public.federal_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_federal_news_published_at ON public.federal_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_federal_news_source ON public.federal_news(source);

-- Create agency_updates table
CREATE TABLE IF NOT EXISTS public.agency_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  content TEXT,
  update_type TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_agency_updates_published_at ON public.agency_updates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_updates_agency ON public.agency_updates(agency);

-- Enable RLS
ALTER TABLE public.federal_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_updates ENABLE ROW LEVEL SECURITY;

-- Create policies - these are public intelligence data, viewable by all authenticated users
CREATE POLICY "Federal news are viewable by authenticated users" 
ON public.federal_news 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Agency updates are viewable by authenticated users" 
ON public.agency_updates 
FOR SELECT 
TO authenticated
USING (true);-- Create table for user's reference documents (PWS, capabilities, past projects)
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
EXECUTE FUNCTION public.update_updated_at_column();-- Create storage bucket for reference documents
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
ADD COLUMN storage_path text;-- Create junction table to link capabilities with reference documents
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
CREATE INDEX idx_capability_documents_document_id ON capability_documents(document_id);-- Add position field to opportunities table for card ordering within columns
ALTER TABLE opportunities 
ADD COLUMN position integer DEFAULT 0;

-- Create index for better query performance
CREATE INDEX idx_opportunities_status_position ON opportunities(status, position);

-- Update existing opportunities to have sequential positions within their status
WITH ranked_opps AS (
  SELECT id, status, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) - 1 AS new_position
  FROM opportunities
)
UPDATE opportunities
SET position = ranked_opps.new_position
FROM ranked_opps
WHERE opportunities.id = ranked_opps.id;-- Drop existing policies if they exist to recreate them
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
);-- Create table for caching SAM.gov search results
CREATE TABLE public.sam_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_hash TEXT NOT NULL UNIQUE,
  search_criteria JSONB NOT NULL,
  results JSONB NOT NULL,
  total_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  user_id UUID NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_sam_search_cache_hash ON public.sam_search_cache(search_hash);
CREATE INDEX idx_sam_search_cache_expires ON public.sam_search_cache(expires_at);
CREATE INDEX idx_sam_search_cache_user ON public.sam_search_cache(user_id);

-- Enable RLS
ALTER TABLE public.sam_search_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cached searches
CREATE POLICY "Users can view their own cached searches"
  ON public.sam_search_cache
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cached searches
CREATE POLICY "Users can insert their own cached searches"
  ON public.sam_search_cache
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cached searches
CREATE POLICY "Users can delete their own cached searches"
  ON public.sam_search_cache
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to clean up expired cache entries (can be called by a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sam_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.sam_search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE public.sam_search_cache IS 'Caches SAM.gov search results to reduce API calls. Entries expire after 24 hours.';-- Create bd_opportunities table (distinct from existing opportunities table)
CREATE TABLE IF NOT EXISTS public.bd_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('pipeline', 'stage0', 'stage1', 'white_paper', 'cso', 'long_range')),
  owner TEXT,
  supporting_owners TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'watch', 'closed', 'no_go')),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bd_transcripts table
CREATE TABLE IF NOT EXISTS public.bd_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of DATE NOT NULL,
  label TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bd_opportunity_status table (weekly snapshots)
CREATE TABLE IF NOT EXISTS public.bd_opportunity_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('0_30', '31_60', 'gt_60', 'long_range', 'n_a')),
  health TEXT NOT NULL CHECK (health IN ('green', 'yellow', 'orange', 'red', 'none')),
  summary TEXT,
  raw_notes TEXT,
  due_date DATE,
  flags JSONB DEFAULT '{}',
  source_transcript_id UUID REFERENCES public.bd_transcripts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, week_of)
);

-- Enable RLS
ALTER TABLE public.bd_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_opportunity_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for bd_opportunities
CREATE POLICY "Users can manage their BD opportunities"
  ON public.bd_opportunities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for bd_transcripts
CREATE POLICY "Users can manage their BD transcripts"
  ON public.bd_transcripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for bd_opportunity_status
CREATE POLICY "Users can view BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete BD status for their opportunities"
  ON public.bd_opportunity_status
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities
      WHERE bd_opportunities.id = bd_opportunity_status.opportunity_id
        AND bd_opportunities.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_bd_opportunities_user_id ON public.bd_opportunities(user_id);
CREATE INDEX idx_bd_transcripts_user_id ON public.bd_transcripts(user_id);
CREATE INDEX idx_bd_transcripts_week_of ON public.bd_transcripts(week_of);
CREATE INDEX idx_bd_opportunity_status_opportunity_id ON public.bd_opportunity_status(opportunity_id);
CREATE INDEX idx_bd_opportunity_status_week_of ON public.bd_opportunity_status(week_of);

-- Trigger to update updated_at
CREATE TRIGGER update_bd_opportunities_updated_at
  BEFORE UPDATE ON public.bd_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_opportunity_status_updated_at
  BEFORE UPDATE ON public.bd_opportunity_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.bd_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  notify_health_changes BOOLEAN DEFAULT true,
  notify_due_dates BOOLEAN DEFAULT true,
  due_date_warning_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create notification history table
CREATE TABLE IF NOT EXISTS public.bd_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('health_change', 'due_date_warning')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.bd_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_notification_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their notification preferences"
  ON public.bd_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their notification history"
  ON public.bd_notification_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_bd_notification_history_user_id ON public.bd_notification_history(user_id);
CREATE INDEX idx_bd_notification_history_sent_at ON public.bd_notification_history(sent_at);

-- Function to notify on health status change
CREATE OR REPLACE FUNCTION notify_health_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if health actually changed and isn't 'none'
  IF (OLD.health IS DISTINCT FROM NEW.health) AND NEW.health != 'none' THEN
    -- Insert a notification job (the edge function will process these)
    INSERT INTO public.bd_notification_history (user_id, opportunity_id, notification_type, details)
    SELECT 
      o.user_id,
      NEW.opportunity_id,
      'health_change',
      jsonb_build_object(
        'old_health', OLD.health,
        'new_health', NEW.health,
        'opportunity_name', o.name,
        'summary', NEW.summary
      )
    FROM public.bd_opportunities o
    WHERE o.id = NEW.opportunity_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for health changes
CREATE TRIGGER bd_opportunity_health_change_trigger
  AFTER UPDATE ON public.bd_opportunity_status
  FOR EACH ROW
  EXECUTE FUNCTION notify_health_status_change();

-- Trigger to update updated_at
CREATE TRIGGER update_bd_notification_preferences_updated_at
  BEFORE UPDATE ON public.bd_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create company status board table for tracking all company opportunities
CREATE TABLE public.company_status_board (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_name TEXT NOT NULL,
  short_name TEXT,
  status_summary TEXT,
  health TEXT DEFAULT 'none',
  owner TEXT,
  due_date DATE,
  category TEXT, -- pipeline, stage0, stage1, white_paper, cso, long_range
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  week_of DATE NOT NULL,
  source_transcript_id UUID,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_status_board ENABLE ROW LEVEL SECURITY;

-- Policies for company status board
CREATE POLICY "Users can view all company status entries"
  ON public.company_status_board
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their company status entries"
  ON public.company_status_board
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_company_status_board_updated_at
  BEFORE UPDATE ON public.company_status_board
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for company status transcripts
CREATE TABLE public.company_status_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_of DATE NOT NULL,
  raw_text TEXT NOT NULL,
  label TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_status_transcripts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view company transcripts"
  ON public.company_status_transcripts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their company transcripts"
  ON public.company_status_transcripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);-- Add outcome tracking for historical pattern learning
CREATE TABLE IF NOT EXISTS public.opportunity_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no-bid', 'in-progress')),
  outcome_date DATE,
  win_probability DECIMAL(5,2), -- AI predicted probability
  actual_value DECIMAL(15,2), -- actual contract value if won
  lessons_learned TEXT,
  success_factors TEXT[], -- what worked
  failure_factors TEXT[], -- what didn't work
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add AI insights and recommendations
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL, -- 'action', 'resource', 'timing', 'strategy'
  recommendation TEXT NOT NULL,
  confidence_score DECIMAL(5,2), -- 0-100
  based_on_opportunities UUID[], -- similar past opportunities used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- recommendations can expire
);

-- Weekly insights summary
CREATE TABLE IF NOT EXISTS public.weekly_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_of DATE NOT NULL,
  pipeline_health_score DECIMAL(5,2),
  trends JSONB, -- trend analysis
  alerts JSONB, -- important alerts
  top_opportunities UUID[], -- opportunities needing attention
  insights_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.opportunity_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunity_outcomes
CREATE POLICY "Users can manage outcomes for their opportunities"
  ON public.opportunity_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = opportunity_outcomes.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = opportunity_outcomes.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_recommendations
CREATE POLICY "Users can view recommendations for their opportunities"
  ON public.ai_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = ai_recommendations.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert AI recommendations"
  ON public.ai_recommendations
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for weekly_insights
CREATE POLICY "Users can manage their weekly insights"
  ON public.weekly_insights
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_opportunity_outcomes_opportunity ON public.opportunity_outcomes(opportunity_id);
CREATE INDEX idx_ai_recommendations_opportunity ON public.ai_recommendations(opportunity_id);
CREATE INDEX idx_weekly_insights_user_week ON public.weekly_insights(user_id, week_of);

-- Add trigger for updated_at
CREATE TRIGGER update_opportunity_outcomes_updated_at
  BEFORE UPDATE ON public.opportunity_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create calendar events table for non-opportunity events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'travel', 'meeting', 'reminder', 'personal', 'other'
  start_date DATE NOT NULL,
  end_date DATE,
  all_day BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  location TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their calendar events"
  ON public.calendar_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_calendar_events_user_date ON public.calendar_events(user_id, start_date);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(event_type);

-- Add trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add company profile table for AI analysis
CREATE TABLE IF NOT EXISTS public.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_customers TEXT[] DEFAULT '{}',
  contract_vehicles TEXT[] DEFAULT '{}',
  set_asides TEXT[] DEFAULT '{}',
  past_performance_areas TEXT[] DEFAULT '{}',
  target_agencies TEXT[] DEFAULT '{}',
  technical_expertise TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own company profile"
  ON public.company_profile
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add AI scoring fields to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS ai_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_recommendation_reason TEXT,
  ADD COLUMN IF NOT EXISTS customer_alignment_score INTEGER,
  ADD COLUMN IF NOT EXISTS technical_fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS contract_vehicle_score INTEGER,
  ADD COLUMN IF NOT EXISTS win_probability_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMP WITH TIME ZONE;

-- Update trigger for company_profile
CREATE TRIGGER update_company_profile_updated_at
  BEFORE UPDATE ON public.company_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Fix search_path for the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;-- Create table for SAM.gov RSS feed monitoring
CREATE TABLE IF NOT EXISTS public.sam_rss_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  agencies TEXT[] DEFAULT '{}',
  naics_codes TEXT[] DEFAULT '{}',
  notice_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_rss_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for RSS subscriptions
CREATE POLICY "Users can view their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_sam_rss_subscriptions_updated_at
  BEFORE UPDATE ON public.sam_rss_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Enable realtime for opportunities table
ALTER PUBLICATION supabase_realtime ADD TABLE opportunities;-- Create table for YouTube channels to monitor
CREATE TABLE youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Create table for extracted YouTube knowledge
CREATE TABLE youtube_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  channel_id UUID REFERENCES youtube_channels(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  transcript TEXT,
  -- Extracted insights
  win_strategies JSONB DEFAULT '[]'::jsonb,
  technical_approaches JSONB DEFAULT '[]'::jsonb,
  best_practices JSONB DEFAULT '[]'::jsonb,
  red_flags JSONB DEFAULT '[]'::jsonb,
  key_themes TEXT[],
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Create table for deep document analysis
CREATE TABLE document_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES reference_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Extracted intelligence
  win_themes JSONB DEFAULT '[]'::jsonb,
  technical_strategies JSONB DEFAULT '[]'::jsonb,
  past_performance_patterns JSONB DEFAULT '[]'::jsonb,
  compliance_keywords TEXT[],
  reusable_content JSONB DEFAULT '[]'::jsonb,
  capability_mappings JSONB DEFAULT '{}'::jsonb,
  sentiment_analysis JSONB DEFAULT '{}'::jsonb,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, user_id)
);

-- Enable RLS
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS Policies for youtube_channels
CREATE POLICY "Users can manage their own YouTube channels"
ON youtube_channels FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for youtube_knowledge
CREATE POLICY "Users can view their own YouTube knowledge"
ON youtube_knowledge FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert YouTube knowledge"
ON youtube_knowledge FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own YouTube knowledge"
ON youtube_knowledge FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for document_knowledge
CREATE POLICY "Users can view their own document knowledge"
ON document_knowledge FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert/update document knowledge"
ON document_knowledge FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_youtube_knowledge_user_id ON youtube_knowledge(user_id);
CREATE INDEX idx_youtube_knowledge_relevance ON youtube_knowledge(relevance_score DESC);
CREATE INDEX idx_document_knowledge_user_id ON document_knowledge(user_id);
CREATE INDEX idx_youtube_channels_user_id ON youtube_channels(user_id, is_active);-- Create app_role enum
create type public.app_role as enum ('admin', 'user');

-- Create user_roles table
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    created_at timestamp with time zone default now(),
    unique (user_id, role)
);

-- Enable RLS
alter table public.user_roles enable row level security;

-- Create security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Create helper function to get current user's roles
create or replace function public.get_my_roles()
returns setof app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
$$;

-- RLS Policies
-- Only admins can view all roles
create policy "Admins can view all roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
create policy "Users can view their own roles"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- Only admins can insert roles
create policy "Only admins can insert roles"
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete roles
create policy "Only admins can delete roles"
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));-- Enable realtime for reference_documents table so frontend can receive updates
-- when attachments are downloaded in background
ALTER PUBLICATION supabase_realtime ADD TABLE public.reference_documents;-- Create table for DoD contract awards
CREATE TABLE public.dod_contract_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_date DATE NOT NULL,
  announcement_date DATE NOT NULL,
  prime_contractor TEXT NOT NULL,
  location TEXT,
  contract_value NUMERIC,
  contract_value_text TEXT,
  service_branch TEXT NOT NULL,
  description TEXT NOT NULL,
  place_of_performance TEXT,
  contract_number TEXT,
  tags TEXT[] DEFAULT '{}',
  relevance_score INTEGER,
  ai_summary TEXT,
  technology_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX idx_dod_contracts_date ON public.dod_contract_awards(announcement_date DESC);
CREATE INDEX idx_dod_contracts_branch ON public.dod_contract_awards(service_branch);
CREATE INDEX idx_dod_contracts_contractor ON public.dod_contract_awards(prime_contractor);
CREATE INDEX idx_dod_contracts_tags ON public.dod_contract_awards USING GIN(tags);

-- Enable RLS
ALTER TABLE public.dod_contract_awards ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view contract awards
CREATE POLICY "Contract awards are viewable by authenticated users"
  ON public.dod_contract_awards
  FOR SELECT
  TO authenticated
  USING (true);

-- Create table for user contract watchlist
CREATE TABLE public.user_contract_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  notify_on_match BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contractor_name)
);

-- Enable RLS for watchlist
ALTER TABLE public.user_contract_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can manage their own watchlist
CREATE POLICY "Users can manage their own watchlist"
  ON public.user_contract_watchlist
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update trigger for contract awards
CREATE TRIGGER update_dod_contract_awards_updated_at
  BEFORE UPDATE ON public.dod_contract_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add config table for sync tracking
CREATE TABLE IF NOT EXISTS public.sync_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- Allow system to manage sync config
CREATE POLICY "System can manage sync config"
  ON public.sync_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add missing fields to opportunities table if needed
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS sam_id text,
  ADD COLUMN IF NOT EXISTS sub_agency text,
  ADD COLUMN IF NOT EXISTS psc text,
  ADD COLUMN IF NOT EXISTS set_aside text,
  ADD COLUMN IF NOT EXISTS ai_tags text[],
  ADD COLUMN IF NOT EXISTS description text;

-- Create unique index on sam_id for upserts
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_sam_id_idx 
  ON public.opportunities(sam_id) 
  WHERE sam_id IS NOT NULL;

-- Add index for AI score queries
CREATE INDEX IF NOT EXISTS opportunities_ai_score_idx 
  ON public.opportunities(ai_fit_score) 
  WHERE ai_fit_score IS NOT NULL;

-- Add index for posted_date queries
CREATE INDEX IF NOT EXISTS opportunities_posted_date_idx 
  ON public.opportunities(posted_date DESC);

-- Initialize last_sam_sync_time if not exists
INSERT INTO public.sync_config (key, value)
VALUES ('last_sam_sync_time', to_jsonb((now() - interval '7 days')::text))
ON CONFLICT (key) DO NOTHING;-- Add ai_reason and ai_bucket columns to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_bucket text;

-- Add index for bucket queries
CREATE INDEX IF NOT EXISTS opportunities_ai_bucket_idx 
  ON public.opportunities(ai_bucket) 
  WHERE ai_bucket IS NOT NULL;

-- Add check constraint for valid bucket values
ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_ai_bucket_check 
  CHECK (ai_bucket IN ('HIGH_PRIORITY', 'WATCH', 'INFO_ONLY') OR ai_bucket IS NULL);-- Create watchlist table
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);

-- Enable RLS
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own watchlist
CREATE POLICY "Users can view their own watchlist"
  ON public.watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist"
  ON public.watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist"
  ON public.watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX idx_watchlist_opportunity_id ON public.watchlist(opportunity_id);-- ================================================
-- Step 1: Add opportunity_id to bd_opportunities
-- ================================================

-- Add the foreign key column (nullable for now, will backfill)
ALTER TABLE public.bd_opportunities 
ADD COLUMN opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_bd_opportunities_opportunity_id ON public.bd_opportunities(opportunity_id);

-- ================================================
-- Step 2: Backfill opportunity_id for existing rows
-- ================================================

-- Match by title similarity (case-insensitive)
-- This handles most cases where names are similar
UPDATE public.bd_opportunities bd
SET opportunity_id = (
  SELECT o.id
  FROM public.opportunities o
  WHERE LOWER(o.title) LIKE '%' || LOWER(COALESCE(bd.short_name, bd.name)) || '%'
     OR LOWER(COALESCE(bd.short_name, bd.name)) LIKE '%' || LOWER(o.title) || '%'
  LIMIT 1
)
WHERE bd.opportunity_id IS NULL;

-- ================================================
-- Step 3: Add opportunity_id to bd_opportunity_status (denormalized)
-- ================================================

-- Add denormalized opportunity_id column for easier querying
ALTER TABLE public.bd_opportunity_status 
ADD COLUMN linked_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE;

-- Backfill from parent bd_opportunities
UPDATE public.bd_opportunity_status bos
SET linked_opportunity_id = (
  SELECT bd.opportunity_id
  FROM public.bd_opportunities bd
  WHERE bd.id = bos.opportunity_id
)
WHERE bos.linked_opportunity_id IS NULL;

-- Create index for performance
CREATE INDEX idx_bd_opportunity_status_linked_opportunity_id ON public.bd_opportunity_status(linked_opportunity_id);

-- ================================================
-- Comments for documentation
-- ================================================

COMMENT ON COLUMN public.bd_opportunities.opportunity_id IS 'Links to canonical opportunity in public.opportunities table';
COMMENT ON COLUMN public.bd_opportunity_status.linked_opportunity_id IS 'Denormalized link to public.opportunities for easier querying of latest status';-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create centralized knowledge base for all BD intelligence sources
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'publication', 'podcast', 'hatch', 'defense_contract', 'sam', 'linkedin', 'newsletter')),
  source_url TEXT,
  source_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  full_text TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding vector(1536),
  tags TEXT[],
  relevance_score NUMERIC DEFAULT 50,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own knowledge base"
  ON public.knowledge_base
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge base"
  ON public.knowledge_base
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge base"
  ON public.knowledge_base
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge base"
  ON public.knowledge_base
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_knowledge_base_user_id ON public.knowledge_base(user_id);
CREATE INDEX idx_knowledge_base_source_type ON public.knowledge_base(source_type);
CREATE INDEX idx_knowledge_base_published_at ON public.knowledge_base(published_at DESC);
CREATE INDEX idx_knowledge_base_relevance_score ON public.knowledge_base(relevance_score DESC);
CREATE INDEX idx_knowledge_base_source_id ON public.knowledge_base(source_id);
CREATE INDEX idx_knowledge_base_tags ON public.knowledge_base USING GIN(tags);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX idx_knowledge_base_embedding ON public.knowledge_base USING hnsw (embedding vector_cosine_ops);

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add active_pursuit column to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS active_pursuit BOOLEAN NOT NULL DEFAULT false;

-- Index for active_pursuit filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_active_pursuit ON public.opportunities(user_id, active_pursuit) WHERE active_pursuit = true;

-- Backfill active_pursuit for opportunities already in watchlist or with certain statuses
UPDATE public.opportunities
SET active_pursuit = true
WHERE id IN (
  SELECT DISTINCT opportunity_id FROM public.watchlist
)
OR status IN ('Pursuing', 'Bidding', 'Submitted', 'Won', 'Lost');-- Add AI briefing columns to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN ai_brief jsonb,
ADD COLUMN ai_brief_updated_at timestamptz;

-- Add index for quick lookup of stale briefs
CREATE INDEX idx_opportunities_ai_brief_updated ON public.opportunities(ai_brief_updated_at)
WHERE ai_brief_updated_at IS NOT NULL;-- Drop the overly restrictive SELECT policy on knowledge_base
DROP POLICY IF EXISTS "Users can view their own knowledge base" ON public.knowledge_base;

-- Create a new SELECT policy that allows authenticated users to view all knowledge_base entries
CREATE POLICY "Authenticated users can view all knowledge base"
  ON public.knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep the restrictive INSERT/UPDATE/DELETE policies so users can only modify their own entries
-- (Those policies already exist and are correctly scoped to auth.uid() = user_id)-- Drop the old check constraint that doesn't allow OUT_OF_SCOPE
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

-- Add new check constraint that includes OUT_OF_SCOPE
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_ai_bucket_check 
  CHECK (ai_bucket IN ('HIGH_PRIORITY', 'WATCH', 'INFO_ONLY', 'OUT_OF_SCOPE', 'REVIEW'));-- Create ai_feedback table to track user feedback on opportunities
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.ai_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.ai_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON public.ai_feedback
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created_at ON public.ai_feedback(created_at);
CREATE INDEX idx_ai_feedback_type ON public.ai_feedback(feedback_type);

-- Create persona_weightings table to store learned tag weightings
CREATE TABLE public.persona_weightings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tag_weightings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_trained_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  training_data_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.persona_weightings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own persona weightings
CREATE POLICY "Users can manage their own persona weightings"
ON public.persona_weightings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_persona_weightings_user_id ON public.persona_weightings(user_id);-- Add is_user_pursuit column to opportunities table
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
WHERE is_user_pursuit = true;-- Backfill known pursuits (ARES, WARMIX, ATM, IBCS)
-- Set is_user_pursuit = TRUE for existing opportunities that are known pursuits
UPDATE public.opportunities
SET is_user_pursuit = TRUE
WHERE (
  title ILIKE '%ARES%'
  OR title ILIKE '%WARMIX%'
  OR title ILIKE '%ATM%'
  OR title ILIKE '%IBCS%'
)
AND is_user_pursuit = FALSE;-- Create documents table for company knowledge management
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
  EXECUTE FUNCTION public.increment_document_usage();-- Fix security warning: Set search_path for increment_document_usage function
DROP FUNCTION IF EXISTS public.increment_document_usage() CASCADE;

CREATE OR REPLACE FUNCTION public.increment_document_usage()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER increment_document_usage_on_link
  AFTER INSERT ON public.opportunity_documents_link
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_document_usage();-- Create user preferences table for market intelligence settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  use_trends_for_scoring BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);-- Create meeting_pipelines table
CREATE TABLE public.meeting_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  meeting_date DATE,
  transcript_source TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  share_token UUID DEFAULT gen_random_uuid(),
  is_public BOOLEAN DEFAULT false
);

-- Create meeting_pipeline_items table
CREATE TABLE public.meeting_pipeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.meeting_pipelines(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  title TEXT NOT NULL,
  short_summary TEXT,
  owner TEXT,
  urgency_level TEXT,
  time_horizon TEXT,
  status_tag TEXT DEFAULT 'Gray',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_pipeline_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_pipelines
CREATE POLICY "Users can manage their own meeting pipelines"
  ON public.meeting_pipelines
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public pipelines are viewable by anyone with share token"
  ON public.meeting_pipelines
  FOR SELECT
  USING (is_public = true);

-- RLS policies for meeting_pipeline_items
CREATE POLICY "Users can manage items in their pipelines"
  ON public.meeting_pipeline_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Items in public pipelines are viewable by anyone"
  ON public.meeting_pipeline_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_pipelines
      WHERE public.meeting_pipelines.id = meeting_pipeline_items.pipeline_id
      AND public.meeting_pipelines.is_public = true
    )
  );

-- Create indexes
CREATE INDEX idx_meeting_pipeline_items_pipeline_id ON public.meeting_pipeline_items(pipeline_id);
CREATE INDEX idx_meeting_pipeline_items_stage ON public.meeting_pipeline_items(stage_name);
CREATE INDEX idx_meeting_pipelines_share_token ON public.meeting_pipelines(share_token);

-- Add trigger for updated_at
CREATE TRIGGER update_meeting_pipelines_updated_at
  BEFORE UPDATE ON public.meeting_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_pipeline_items_updated_at
  BEFORE UPDATE ON public.meeting_pipeline_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for transcripts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meeting-transcripts', 'meeting-transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own transcripts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own transcripts"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own transcripts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'meeting-transcripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );-- Allow public read access to bd_opportunities when no auth
CREATE POLICY "Public can view bd_opportunities"
ON public.bd_opportunities
FOR SELECT
USING (true);

-- Allow public read access to bd_opportunity_status when no auth
CREATE POLICY "Public can view bd_opportunity_status"
ON public.bd_opportunity_status
FOR SELECT
USING (true);

-- Allow public read access to bd_transcripts when no auth
CREATE POLICY "Public can view bd_transcripts"
ON public.bd_transcripts
FOR SELECT
USING (true);-- Create conferences table
CREATE TABLE public.conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create conference_leads table
CREATE TABLE public.conference_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  ai_fit_score INTEGER,
  ai_reason TEXT,
  linked_opportunity_id UUID REFERENCES public.opportunities(id),
  card_image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conferences
CREATE POLICY "Users can view their own conferences"
  ON public.conferences FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own conferences"
  ON public.conferences FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own conferences"
  ON public.conferences FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own conferences"
  ON public.conferences FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for conference_leads
CREATE POLICY "Users can view their own conference leads"
  ON public.conference_leads FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own conference leads"
  ON public.conference_leads FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own conference leads"
  ON public.conference_leads FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own conference leads"
  ON public.conference_leads FOR DELETE
  USING (auth.uid() = created_by);

-- Create indexes for better query performance
CREATE INDEX idx_conferences_created_by ON public.conferences(created_by);
CREATE INDEX idx_conferences_dates ON public.conferences(start_date, end_date);
CREATE INDEX idx_conference_leads_conference_id ON public.conference_leads(conference_id);
CREATE INDEX idx_conference_leads_created_by ON public.conference_leads(created_by);
CREATE INDEX idx_conference_leads_status ON public.conference_leads(status);

-- Add trigger for updated_at
CREATE TRIGGER update_conferences_updated_at
  BEFORE UPDATE ON public.conferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conference_leads_updated_at
  BEFORE UPDATE ON public.conference_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add calendar linking columns to conferences table
ALTER TABLE public.conferences
ADD COLUMN calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
ADD COLUMN calendar_source text;

-- Create index for faster lookups
CREATE INDEX idx_conferences_calendar_event_id ON public.conferences(calendar_event_id);

-- Add comment
COMMENT ON COLUMN public.conferences.calendar_event_id IS 'ID of linked calendar event';
COMMENT ON COLUMN public.conferences.calendar_source IS 'Source of calendar event: internal, google, etc.';-- Add URL ingestion columns to conferences table
ALTER TABLE public.conferences
ADD COLUMN source_url text,
ADD COLUMN website_data jsonb;

-- Create index for faster lookups by URL
CREATE INDEX idx_conferences_source_url ON public.conferences(source_url);

-- Add comments
COMMENT ON COLUMN public.conferences.source_url IS 'Main conference website URL for auto-ingestion';
COMMENT ON COLUMN public.conferences.website_data IS 'Raw parsed metadata snapshot from website';-- Add event type, custom type, color, and icon fields to calendar_events
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS type_custom text,
ADD COLUMN IF NOT EXISTS color_hex text,
ADD COLUMN IF NOT EXISTS icon_name text;

-- Add check constraint for color_hex format (optional but good practice)
ALTER TABLE calendar_events
ADD CONSTRAINT color_hex_format CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$');

-- Create index for faster type queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);-- Add executive summary fields to conferences table
ALTER TABLE conferences 
ADD COLUMN exec_summary jsonb,
ADD COLUMN exec_summary_generated_at timestamptz;-- Create daily_briefs table for persisted daily summaries
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  summary_text TEXT NOT NULL,
  key_headlines JSONB DEFAULT '[]'::jsonb,
  opportunity_highlights JSONB DEFAULT '[]'::jsonb,
  trends JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, brief_date)
);

-- Enable RLS
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own daily briefs"
  ON public.daily_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily briefs"
  ON public.daily_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily briefs"
  ON public.daily_briefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily briefs"
  ON public.daily_briefs FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_briefs_updated_at
  BEFORE UPDATE ON public.daily_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_daily_briefs_user_date ON public.daily_briefs(user_id, brief_date DESC);-- Add AI status tracking fields to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending' CHECK (ai_status IN ('ok', 'pending', 'error')),
ADD COLUMN IF NOT EXISTS ai_error_message text;

-- Update existing opportunities with scores to have ai_status = 'ok'
UPDATE public.opportunities
SET ai_status = 'ok'
WHERE ai_fit_score IS NOT NULL AND ai_scored_at IS NOT NULL;

-- Update existing opportunities with errors in ai_reason to have ai_status = 'error'
UPDATE public.opportunities
SET ai_status = 'error',
    ai_error_message = ai_reason
WHERE ai_reason LIKE '%AI error:%' OR ai_reason LIKE '%error%' OR ai_reason LIKE '%Empty JSON%';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_ai_status ON public.opportunities(ai_status);

COMMENT ON COLUMN public.opportunities.ai_status IS 'AI scoring status: ok (successfully scored), pending (not yet scored), error (scoring failed)';
COMMENT ON COLUMN public.opportunities.ai_error_message IS 'Detailed error message if AI scoring failed';-- Add front_end_solutioning field to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN front_end_solutioning boolean DEFAULT false;

-- Create index for filtering
CREATE INDEX idx_opportunities_front_end_solutioning 
ON public.opportunities(front_end_solutioning) 
WHERE front_end_solutioning = true;-- Add full_submission_draft column to proposals table
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS full_submission_draft text;-- Add sam_last_refreshed_at timestamp to track when SAM data was last refreshed
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS sam_last_refreshed_at timestamptz DEFAULT NULL;-- Add sam_last_refreshed_at column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS sam_last_refreshed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.opportunities.sam_last_refreshed_at IS 'Timestamp of the last successful refresh from SAM.gov API for this opportunity';-- First, drop the existing check constraint and create a new one that includes 'needs_description'
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_status_check;

-- Add the new check constraint with 'needs_description' as a valid value
ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_ai_status_check 
CHECK (ai_status IN ('pending', 'ok', 'error', 'needs_description'));-- Create SAM.gov sync logs table for monitoring
CREATE TABLE IF NOT EXISTS public.sam_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'nightly_refresh', 'manual_refresh', 'search'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_sam_calls INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  opportunities_refreshed INTEGER DEFAULT 0,
  scoring_tasks_triggered INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read logs (for admin panel)
CREATE POLICY "Authenticated users can view sync logs"
  ON public.sam_sync_logs FOR SELECT
  TO authenticated
  USING (true);

-- Index for querying recent logs
CREATE INDEX idx_sam_sync_logs_started_at ON public.sam_sync_logs(started_at DESC);
CREATE INDEX idx_sam_sync_logs_sync_type ON public.sam_sync_logs(sync_type);-- Create SAM.gov job queue table for background processing
CREATE TABLE public.sam_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'notice_refresh', 'search_prefetch'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'done', 'error'
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_job_queue ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view queue (admin monitoring)
CREATE POLICY "Authenticated users can view job queue"
  ON public.sam_job_queue
  FOR SELECT
  USING (true);

-- Index for efficient job polling
CREATE INDEX idx_sam_job_queue_status_next_run ON public.sam_job_queue (status, next_run_at)
  WHERE status = 'pending';

-- Index for cleanup queries
CREATE INDEX idx_sam_job_queue_created_at ON public.sam_job_queue (created_at);

-- Trigger for updated_at
CREATE TRIGGER update_sam_job_queue_updated_at
  BEFORE UPDATE ON public.sam_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));-- Drop the old constraint and add new one with updated bucket values
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_ai_bucket_check;

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_ai_bucket_check 
CHECK (ai_bucket = ANY (ARRAY['CHASE'::text, 'SHAPE'::text, 'MONITOR'::text, 'AVOID'::text, 
                              'HIGH_PRIORITY'::text, 'WATCH'::text, 'INFO_ONLY'::text, 'OUT_OF_SCOPE'::text, 'REVIEW'::text]));-- Create brain_settings table for AI Brain configuration
CREATE TABLE public.brain_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  writing_style TEXT DEFAULT '',
  brain_summary TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.brain_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own brain settings"
ON public.brain_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_brain_settings_updated_at
BEFORE UPDATE ON public.brain_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Drop the existing check constraint
ALTER TABLE public.knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;

-- Recreate with additional allowed source types for brain references
ALTER TABLE public.knowledge_base ADD CONSTRAINT knowledge_base_source_type_check 
CHECK (source_type = ANY (ARRAY[
  'youtube'::text, 
  'publication'::text, 
  'podcast'::text, 
  'hatch'::text, 
  'defense_contract'::text, 
  'sam'::text, 
  'linkedin'::text, 
  'newsletter'::text,
  'brain_reference'::text,
  'company_profile'::text,
  'exemplar'::text,
  'user_upload'::text
]));-- Add multi-source fields to opportunities table
-- These fields track where each opportunity came from and support multiple external providers

-- Add source_provider to track which provider the opportunity came from
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'sam_gov';

-- Add external_id to store provider-specific ID (SAM Notice ID, aggregator internal ID, etc.)
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_id text NULL;

-- Add external_url to store the canonical URL to the opportunity page
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_url text NULL;

-- Add external_metadata to store arbitrary metadata from the provider
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS external_metadata jsonb NULL DEFAULT '{}'::jsonb;

-- Add last_refreshed_at to track when the opportunity was last refreshed from source
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp with time zone NULL;

-- Create an index on source_provider for efficient filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_source_provider ON public.opportunities(source_provider);

-- Create an index on external_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_external_id ON public.opportunities(external_id);

-- Add a comment explaining the source_provider values
COMMENT ON COLUMN public.opportunities.source_provider IS 'Provider source: sam_gov, samsearch, govwin, govtribe, govspend, manual, other_url';-- Add enrichment fields to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS description_raw text,
ADD COLUMN IF NOT EXISTS description_enriched text,
ADD COLUMN IF NOT EXISTS description_source text DEFAULT 'sam_api',
ADD COLUMN IF NOT EXISTS last_enriched_at timestamp with time zone;

-- Add check constraint for description_source
ALTER TABLE public.opportunities
ADD CONSTRAINT check_description_source 
CHECK (description_source IS NULL OR description_source IN ('sam_api', 'sam_scrape', 'web_scrape'));

-- Create index for finding opportunities needing enrichment
CREATE INDEX IF NOT EXISTS idx_opportunities_needs_enrichment 
ON public.opportunities (created_at, last_enriched_at) 
WHERE (description_raw IS NULL OR length(description_raw) < 50);-- Create proposal_ai_events table to log all AI actions
CREATE TABLE public.proposal_ai_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'generate_outline', 'generate_proposal', 'fact_check', 'compliance_check', 'evaluation', 'copilot_chat'
  model_version TEXT NOT NULL, -- 'gpt-5-2025-08-07', etc.
  writing_mode TEXT, -- 'government_formal', 'executive_summary', 'technical_volume', 'capability_statement'
  input_context JSONB DEFAULT '{}'::jsonb, -- RAG sources used, parameters
  output_summary TEXT, -- Brief summary of output
  output_data JSONB DEFAULT '{}'::jsonb, -- Full structured output
  token_usage JSONB DEFAULT '{}'::jsonb, -- prompt_tokens, completion_tokens
  duration_ms INTEGER, -- Processing time
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'partial'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_ai_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view their own proposal AI events"
  ON public.proposal_ai_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY "Users can insert their own proposal AI events"
  ON public.proposal_ai_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_proposal_ai_events_user_id ON public.proposal_ai_events(user_id);
CREATE INDEX idx_proposal_ai_events_opportunity_id ON public.proposal_ai_events(opportunity_id);
CREATE INDEX idx_proposal_ai_events_created_at ON public.proposal_ai_events(created_at DESC);-- Create table for proposal copilot chat history per opportunity
CREATE TABLE public.proposal_copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups by opportunity
CREATE INDEX idx_proposal_copilot_messages_opportunity ON public.proposal_copilot_messages(opportunity_id, created_at);

-- Enable RLS
ALTER TABLE public.proposal_copilot_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own copilot messages
CREATE POLICY "Users can view their own copilot messages"
ON public.proposal_copilot_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own copilot messages
CREATE POLICY "Users can insert their own copilot messages"
ON public.proposal_copilot_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own copilot messages
CREATE POLICY "Users can delete their own copilot messages"
ON public.proposal_copilot_messages
FOR DELETE
USING (auth.uid() = user_id);-- Create contract_awards table for USAspending and future FPDS data
CREATE TABLE public.contract_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- External identifiers
  award_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'usaspending', -- usaspending, fpds, sam_contract
  
  -- Award details
  recipient_name TEXT NOT NULL,
  recipient_uei TEXT,
  recipient_duns TEXT,
  award_amount NUMERIC,
  total_obligation NUMERIC,
  
  -- Dates
  award_date DATE,
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  
  -- Agency info
  awarding_agency TEXT,
  awarding_sub_agency TEXT,
  funding_agency TEXT,
  
  -- Classification
  naics_code TEXT,
  naics_description TEXT,
  psc_code TEXT,
  psc_description TEXT,
  
  -- Set-aside and contract type
  set_aside_type TEXT,
  set_aside_description TEXT,
  contract_type TEXT,
  
  -- Location
  place_of_performance_city TEXT,
  place_of_performance_state TEXT,
  place_of_performance_country TEXT,
  
  -- Description
  award_description TEXT,
  
  -- Subcontract lead scoring (0-100)
  subcontract_lead_score INTEGER DEFAULT 0,
  subcontract_lead_reason TEXT,
  
  -- Watchlist
  is_watchlisted BOOLEAN DEFAULT false,
  watchlist_notes TEXT,
  
  -- Metadata
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint on source + award_id per user
  UNIQUE(user_id, source, award_id)
);

-- Enable RLS
ALTER TABLE public.contract_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own contract awards"
  ON public.contract_awards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contract awards"
  ON public.contract_awards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contract awards"
  ON public.contract_awards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contract awards"
  ON public.contract_awards FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX idx_contract_awards_user_id ON public.contract_awards(user_id);
CREATE INDEX idx_contract_awards_source ON public.contract_awards(source);
CREATE INDEX idx_contract_awards_naics ON public.contract_awards(naics_code);
CREATE INDEX idx_contract_awards_award_date ON public.contract_awards(award_date DESC);
CREATE INDEX idx_contract_awards_subcontract_score ON public.contract_awards(subcontract_lead_score DESC);
CREATE INDEX idx_contract_awards_watchlist ON public.contract_awards(user_id, is_watchlisted) WHERE is_watchlisted = true;

-- Trigger for updated_at
CREATE TRIGGER update_contract_awards_updated_at
  BEFORE UPDATE ON public.contract_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create sync_logs table for tracking sync history
CREATE TABLE public.usaspending_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL, -- 'full', 'incremental'
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  awards_fetched INTEGER DEFAULT 0,
  awards_inserted INTEGER DEFAULT 0,
  awards_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.usaspending_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sync logs"
  ON public.usaspending_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert sync logs"
  ON public.usaspending_sync_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);-- PHASE 2: Contacts and Touchpoints tables

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  org_name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contacts
CREATE POLICY "Users can manage their own contacts"
  ON public.contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Touchpoints table
CREATE TABLE public.touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  related_type TEXT,
  related_id UUID,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.touchpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for touchpoints
CREATE POLICY "Users can manage their own touchpoints"
  ON public.touchpoints
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_org_name ON public.contacts(org_name);
CREATE INDEX idx_touchpoints_user_id ON public.touchpoints(user_id);
CREATE INDEX idx_touchpoints_contact_id ON public.touchpoints(contact_id);
CREATE INDEX idx_touchpoints_related ON public.touchpoints(related_type, related_id);
CREATE INDEX idx_touchpoints_date ON public.touchpoints(date DESC);

-- Update trigger for contacts
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for touchpoints
CREATE TRIGGER update_touchpoints_updated_at
  BEFORE UPDATE ON public.touchpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- PHASE 4: SLED scaffolding - Add level column to opportunities and contract_awards

-- Add level to opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'federal';

-- Add level to contract_awards
ALTER TABLE public.contract_awards 
ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'federal';

-- Indexes for level filtering
CREATE INDEX idx_opportunities_level ON public.opportunities(level);
CREATE INDEX idx_contract_awards_level ON public.contract_awards(level);-- BD Meeting Pipeline - completely separate from main opportunities
-- Stores weekly meeting transcript snapshots
CREATE TABLE public.bd_meeting_pipeline_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_date DATE NOT NULL,
  week_start DATE NOT NULL, -- Always Sunday of that week
  title TEXT NOT NULL,
  raw_transcript TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Items extracted from meeting transcripts
CREATE TABLE public.bd_meeting_pipeline_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.bd_meeting_pipeline_snapshots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer TEXT,
  stage TEXT NOT NULL DEFAULT 'STAGE_0', -- STAGE_0, STAGE_1, STAGE_2, STAGE_3, BIN, ARCHIVED
  owner TEXT,
  next_action TEXT,
  next_action_due DATE,
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  value_estimate NUMERIC,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bd_meeting_pipeline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_meeting_pipeline_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snapshots
CREATE POLICY "Users can view their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
ON public.bd_meeting_pipeline_snapshots 
FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for items (via snapshot ownership)
CREATE POLICY "Users can view items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete items in their snapshots" 
ON public.bd_meeting_pipeline_items 
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.bd_meeting_pipeline_snapshots s 
    WHERE s.id = snapshot_id AND s.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_bd_snapshots_user_week ON public.bd_meeting_pipeline_snapshots(user_id, week_start);
CREATE INDEX idx_bd_items_snapshot ON public.bd_meeting_pipeline_items(snapshot_id);
CREATE INDEX idx_bd_items_stage ON public.bd_meeting_pipeline_items(stage);

-- Update trigger for updated_at
CREATE TRIGGER update_bd_snapshots_updated_at
BEFORE UPDATE ON public.bd_meeting_pipeline_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bd_items_updated_at
BEFORE UPDATE ON public.bd_meeting_pipeline_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Drop the old status check constraint and replace with one matching the Kanban stages
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_status_check 
CHECK (status = ANY (ARRAY['New'::text, 'Pursuing'::text, 'Bidding'::text, 'Submitted'::text, 'Won'::text, 'Lost'::text, 'In Review'::text, 'Active Capture'::text, 'Closed'::text]));-- Add unique constraint for upsert to work
ALTER TABLE public.contract_awards 
ADD CONSTRAINT contract_awards_user_source_award_unique 
UNIQUE (user_id, source, award_id);-- Add AI company fit score column to contract_awards
ALTER TABLE public.contract_awards 
ADD COLUMN IF NOT EXISTS ai_company_fit_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_company_fit_reason text DEFAULT NULL;-- Add folder column to documents table for organizing company documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT NULL;

-- Create an index for faster folder queries
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder);
-- Create a helper function to check if user has ANY role (for access control)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Add UPDATE policy for user_roles (only admins can update)
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update opportunities table: require a role to access
DROP POLICY IF EXISTS "Users can view their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can view their own opportunities"
ON public.opportunities
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can insert their own opportunities"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can update their own opportunities"
ON public.opportunities
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can delete their own opportunities"
ON public.opportunities
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update contract_awards table: require a role to access
DROP POLICY IF EXISTS "Users can view their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can view their own contract awards"
ON public.contract_awards
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can insert their own contract awards"
ON public.contract_awards
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can update their own contract awards"
ON public.contract_awards
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can delete their own contract awards"
ON public.contract_awards
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update knowledge_base table: require a role to access
DROP POLICY IF EXISTS "Users can view their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can view their own knowledge base entries"
ON public.knowledge_base
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can insert their own knowledge base entries"
ON public.knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can update their own knowledge base entries"
ON public.knowledge_base
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can delete their own knowledge base entries"
ON public.knowledge_base
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update daily_briefs table: require a role to access
DROP POLICY IF EXISTS "Users can view their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can view their own briefs"
ON public.daily_briefs
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can insert their own briefs"
ON public.daily_briefs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can update their own briefs"
ON public.daily_briefs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));-- Create user_data_shares table to track what data is shared with whom
CREATE TABLE public.user_data_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type text NOT NULL CHECK (share_type IN ('brain', 'conferences', 'pipeline')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (owner_user_id, shared_with_user_id, share_type)
);

-- Enable RLS
ALTER TABLE public.user_data_shares ENABLE ROW LEVEL SECURITY;

-- Only admins can manage shares
CREATE POLICY "Admins can manage all shares"
ON public.user_data_shares
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view shares they're involved in
CREATE POLICY "Users can view their shares"
ON public.user_data_shares
FOR SELECT
USING (auth.uid() = owner_user_id OR auth.uid() = shared_with_user_id);

-- Create helper function to check if user has read access to another user's data
CREATE OR REPLACE FUNCTION public.has_shared_access(
  _viewer_user_id uuid,
  _owner_user_id uuid,
  _share_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_data_shares
    WHERE owner_user_id = _owner_user_id
      AND shared_with_user_id = _viewer_user_id
      AND share_type = _share_type
  )
$$;

-- Update brain_settings RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their own brain settings" ON public.brain_settings;

CREATE POLICY "Users can view own or shared brain settings"
ON public.brain_settings
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'brain')
);

CREATE POLICY "Users can manage their own brain settings"
ON public.brain_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update company_capabilities RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their capabilities" ON public.company_capabilities;

CREATE POLICY "Users can view own or shared capabilities"
ON public.company_capabilities
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'brain')
);

CREATE POLICY "Users can manage their own capabilities"
ON public.company_capabilities
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update knowledge_base RLS to allow shared read access (for brain type)
CREATE POLICY "Users can view shared knowledge base"
ON public.knowledge_base
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'brain'));

-- Update conferences RLS to allow shared read access
DROP POLICY IF EXISTS "Users can view their own conferences" ON public.conferences;

CREATE POLICY "Users can view own or shared conferences"
ON public.conferences
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.has_shared_access(auth.uid(), created_by, 'conferences')
);

-- Update conference_leads RLS to allow shared read access
DROP POLICY IF EXISTS "Users can view their own conference leads" ON public.conference_leads;

CREATE POLICY "Users can view own or shared conference leads"
ON public.conference_leads
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.has_shared_access(auth.uid(), created_by, 'conferences')
);

-- Update calendar_events RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their calendar events" ON public.calendar_events;

CREATE POLICY "Users can view own or shared calendar events"
ON public.calendar_events
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'conferences')
);

CREATE POLICY "Users can manage their own calendar events"
ON public.calendar_events
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update opportunities RLS to allow shared read access for pipeline
CREATE POLICY "Users can view shared opportunities"
ON public.opportunities
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Update contract_awards RLS to allow shared read access for pipeline
CREATE POLICY "Users can view shared contract awards"
ON public.contract_awards
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'pipeline'));-- Create a function that calls the send-calendar-invite edge function
CREATE OR REPLACE FUNCTION public.trigger_send_calendar_invite()
RETURNS trigger AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get the Supabase URL from the current database
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Make HTTP request to the edge function
  PERFORM net.http_post(
    url := 'https://murkjzfsfqhxphwndebq.supabase.co/functions/v1/send-calendar-invite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cmtqemZzZnFoeHBod25kZWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzUzOTUsImV4cCI6MjA3OTc1MTM5NX0.V-QqE1A8TgaoN_hQPRA0yGfLcXjraEaKMj_y_4FK1Zc'
    ),
    body := jsonb_build_object('event_id', NEW.id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on calendar_events table
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;

CREATE TRIGGER on_calendar_event_created
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_calendar_invite();-- Add invite_email column to calendar_events for sending invites to specific recipients
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS invite_email TEXT;
-- Add RLS policy for viewing shared BD pipeline snapshots
CREATE POLICY "Users can view shared pipeline snapshots"
ON public.bd_meeting_pipeline_snapshots
FOR SELECT
USING (has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Add RLS policy for viewing items in shared pipeline snapshots
CREATE POLICY "Users can view items in shared pipeline snapshots"
ON public.bd_meeting_pipeline_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bd_meeting_pipeline_snapshots s
    WHERE s.id = bd_meeting_pipeline_items.snapshot_id
    AND has_shared_access(auth.uid(), s.user_id, 'pipeline')
  )
);

-- Create notifications table for share alerts
CREATE TABLE public.share_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  share_type TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.share_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.share_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.share_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.share_notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can insert notifications (when sharing)
CREATE POLICY "Admins can insert notifications"
ON public.share_notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create trigger to auto-notify when a share is created
CREATE OR REPLACE FUNCTION public.notify_on_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.share_notifications (user_id, from_user_id, share_type, message)
  VALUES (
    NEW.shared_with_user_id,
    NEW.owner_user_id,
    NEW.share_type,
    CASE NEW.share_type
      WHEN 'pipeline' THEN 'You now have access to a shared BD Pipeline'
      WHEN 'brain' THEN 'You now have access to shared AI Brain data'
      WHEN 'conferences' THEN 'You now have access to shared Conferences'
      ELSE 'You have been granted shared access'
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_share_created
AFTER INSERT ON public.user_data_shares
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_share();
-- Create BD Library table for saved pipeline items
CREATE TABLE public.bd_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  short_summary TEXT,
  owner TEXT,
  time_horizon TEXT,
  status_tag TEXT DEFAULT 'Gray',
  urgency_level TEXT,
  notes TEXT,
  source_pipeline_id UUID REFERENCES public.meeting_pipelines(id) ON DELETE SET NULL,
  source_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bd_library ENABLE ROW LEVEL SECURITY;

-- Users can manage their own library items
CREATE POLICY "Users can manage their own library items"
ON public.bd_library
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view shared library items
CREATE POLICY "Users can view shared library items"
ON public.bd_library
FOR SELECT
USING (has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Create trigger for updated_at
CREATE TRIGGER update_bd_library_updated_at
BEFORE UPDATE ON public.bd_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Add resolved_channel_id column to cache the YouTube channel ID
ALTER TABLE youtube_channels 
ADD COLUMN IF NOT EXISTS resolved_channel_id TEXT;-- Add description column to youtube_knowledge for richer content
ALTER TABLE youtube_knowledge 
ADD COLUMN IF NOT EXISTS description TEXT;-- Drop the overly permissive public SELECT policy on bd_transcripts
DROP POLICY IF EXISTS "Public can view bd_transcripts" ON bd_transcripts;

-- The existing "Users can manage their BD transcripts" policy already handles proper access control
-- with USING (auth.uid() = user_id)-- Add registration_url column to calendar_events table
ALTER TABLE public.calendar_events 
ADD COLUMN registration_url text;-- Add source_text column to store the transcript excerpt that the AI used for each item
ALTER TABLE public.bd_meeting_pipeline_items 
ADD COLUMN IF NOT EXISTS source_text text;-- Add linkedin_url column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_url text;-- Add archived column to conferences table
ALTER TABLE public.conferences 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX idx_conferences_archived ON public.conferences(archived);-- Create conference_collaborators table for sharing conferences with partners
CREATE TABLE public.conference_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    invited_by UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'partner',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(conference_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conference_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can manage collaborators
CREATE POLICY "Conference owners can manage collaborators"
ON public.conference_collaborators
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.conferences 
        WHERE id = conference_collaborators.conference_id 
        AND created_by = auth.uid()
    )
);

-- Collaborators can view their own collaborations
CREATE POLICY "Users can view their collaborations"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid());

-- Update conference_leads RLS to allow collaborators to view all leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.conference_leads;

-- View: Owner or collaborator can see all leads for shared conferences
CREATE POLICY "Users can view leads for owned or shared conferences"
ON public.conference_leads
FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.conference_collaborators
        WHERE conference_id = conference_leads.conference_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.conferences
        WHERE id = conference_leads.conference_id
        AND created_by = auth.uid()
    )
);

-- Insert: Owner or collaborator can add leads
CREATE POLICY "Users can insert leads for owned or shared conferences"
ON public.conference_leads
FOR INSERT
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.conferences
            WHERE id = conference_leads.conference_id
            AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.conference_collaborators
            WHERE conference_id = conference_leads.conference_id
            AND user_id = auth.uid()
        )
    )
);

-- Update: Only edit your own leads
CREATE POLICY "Users can update their own leads"
ON public.conference_leads
FOR UPDATE
USING (created_by = auth.uid());

-- Delete: Only delete your own leads
CREATE POLICY "Users can delete their own leads"
ON public.conference_leads
FOR DELETE
USING (created_by = auth.uid());

-- Allow collaborators to view the conference itself
DROP POLICY IF EXISTS "Users can view own conferences" ON public.conferences;

CREATE POLICY "Users can view owned or shared conferences"
ON public.conferences
FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.conference_collaborators
        WHERE conference_id = conferences.id
        AND user_id = auth.uid()
    )
);-- Fix infinite recursion in RLS policies for conferences and conference_collaborators
-- The issue is that conferences SELECT policy references conference_collaborators,
-- and conference_collaborators SELECT policy references conferences, causing a loop.

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view conferences they created or collaborate on" ON public.conferences;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can manage collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Collaborators can view shared conferences" ON public.conferences;

-- Recreate conference_collaborators policies WITHOUT referencing conferences table
CREATE POLICY "Users can view collaborations they are part of"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Owners can insert collaborators"
ON public.conference_collaborators
FOR INSERT
WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Owners can delete collaborators"
ON public.conference_collaborators
FOR DELETE
USING (invited_by = auth.uid());

-- Recreate conferences SELECT policy using a simple subquery that doesn't cause recursion
-- The key is to not have conference_collaborators policy depend on conferences
CREATE POLICY "Users can view own or collaborated conferences"
ON public.conferences
FOR SELECT
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conference_collaborators 
    WHERE conference_collaborators.conference_id = conferences.id 
    AND conference_collaborators.user_id = auth.uid()
  )
);-- Clean up ALL old/duplicate/recursive policies causing infinite recursion

-- Drop ALL existing policies on conference_collaborators
DROP POLICY IF EXISTS "Conference owners can manage collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can delete collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can insert collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Users can view collaborations they are part of" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Users can view their collaborations" ON public.conference_collaborators;

-- Drop ALL existing SELECT policies on conferences (keeping INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Users can view own or collaborated conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can view own or shared conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can view owned or shared conferences" ON public.conferences;

-- Recreate clean conference_collaborators policies (NO references to conferences table)
CREATE POLICY "Collaborators select own records"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Collaborators insert by inviter"
ON public.conference_collaborators
FOR INSERT
WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Collaborators delete by inviter"
ON public.conference_collaborators
FOR DELETE
USING (invited_by = auth.uid());

-- Recreate clean conferences SELECT policy (this queries conference_collaborators which no longer queries back)
CREATE POLICY "Conferences select own or collaborated"
ON public.conferences
FOR SELECT
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conference_collaborators cc
    WHERE cc.conference_id = id 
    AND cc.user_id = auth.uid()
  )
);-- Voice recaps table for conference conversation recordings
CREATE TABLE IF NOT EXISTS conference_voice_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES conference_leads(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  audio_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Share links table for public read-only conference access
CREATE TABLE IF NOT EXISTS conference_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_recaps_conference ON conference_voice_recaps(conference_id);
CREATE INDEX IF NOT EXISTS idx_voice_recaps_lead ON conference_voice_recaps(lead_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON conference_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_conference ON conference_share_links(conference_id);

-- Enable RLS
ALTER TABLE conference_voice_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_share_links ENABLE ROW LEVEL SECURITY;

-- RLS for conference_voice_recaps:
-- Users can insert their own recaps
CREATE POLICY "Users can insert own voice recaps"
  ON conference_voice_recaps FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

-- Users can view recaps if they are the conference owner or a collaborator
CREATE POLICY "Users can view recaps for their conferences"
  ON conference_voice_recaps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM conference_collaborators cc WHERE cc.conference_id = conference_voice_recaps.conference_id AND cc.user_id = auth.uid()
    )
  );

-- Public read access via valid share token (for the /shared/:token route)
-- This requires the anon key to query - we handle token validation in the app
CREATE POLICY "Public can view recaps via share link"
  ON conference_voice_recaps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conference_share_links sl
      WHERE sl.conference_id = conference_voice_recaps.conference_id
        AND sl.is_active = true
        AND (sl.expires_at IS NULL OR sl.expires_at > now())
    )
  );

-- RLS for conference_share_links:
-- Only conference owner can manage share links
CREATE POLICY "Conference owner can manage share links"
  ON conference_share_links FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Anyone can read active share links (needed for public /shared/:token route)
CREATE POLICY "Public can read active share links"
  ON conference_share_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Update conference_leads RLS to allow collaborators to see all leads
-- Drop existing restrictive policy if it exists and create a broader one
DO $$
BEGIN
  -- Add policy for collaborators to see all leads in shared conferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Collaborators can view all conference leads' AND tablename = 'conference_leads'
  ) THEN
    CREATE POLICY "Collaborators can view all conference leads"
      ON conference_leads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM conference_collaborators cc
          WHERE cc.conference_id = conference_leads.conference_id AND cc.user_id = auth.uid()
        )
      );
  END IF;

  -- Add policy for public share link access to leads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view leads via share link' AND tablename = 'conference_leads'
  ) THEN
    CREATE POLICY "Public can view leads via share link"
      ON conference_leads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM conference_share_links sl
          WHERE sl.conference_id = conference_leads.conference_id
            AND sl.is_active = true
            AND (sl.expires_at IS NULL OR sl.expires_at > now())
        )
      );
  END IF;
END $$;
