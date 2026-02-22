-- Create company capabilities profile table
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
ADD COLUMN IF NOT EXISTS pursuit_status TEXT DEFAULT 'pending';