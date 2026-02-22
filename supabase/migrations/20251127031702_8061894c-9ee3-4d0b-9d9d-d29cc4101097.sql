-- Add source field to opportunities table
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
CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source);