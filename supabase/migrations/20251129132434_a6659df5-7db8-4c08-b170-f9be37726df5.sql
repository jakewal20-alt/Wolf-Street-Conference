-- Enable pgvector extension for embeddings
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
OR status IN ('Pursuing', 'Bidding', 'Submitted', 'Won', 'Lost');