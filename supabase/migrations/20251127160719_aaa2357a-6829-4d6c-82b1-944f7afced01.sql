-- Add position field to opportunities table for card ordering within columns
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
WHERE opportunities.id = ranked_opps.id;