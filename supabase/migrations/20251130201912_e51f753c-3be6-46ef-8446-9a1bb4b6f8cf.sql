-- Add executive summary fields to conferences table
ALTER TABLE conferences 
ADD COLUMN exec_summary jsonb,
ADD COLUMN exec_summary_generated_at timestamptz;