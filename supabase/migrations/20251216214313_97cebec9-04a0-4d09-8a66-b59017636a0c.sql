-- Add description column to youtube_knowledge for richer content
ALTER TABLE youtube_knowledge 
ADD COLUMN IF NOT EXISTS description TEXT;