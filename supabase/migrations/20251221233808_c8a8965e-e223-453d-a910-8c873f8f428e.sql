-- Add linkedin_url column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_url text;