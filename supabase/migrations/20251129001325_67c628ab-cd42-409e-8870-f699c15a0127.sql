-- Create table for YouTube channels to monitor
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
CREATE INDEX idx_youtube_channels_user_id ON youtube_channels(user_id, is_active);