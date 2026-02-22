-- Add full_submission_draft column to proposals table
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS full_submission_draft text;