-- Add resolved_channel_id column to cache the YouTube channel ID
ALTER TABLE youtube_channels 
ADD COLUMN IF NOT EXISTS resolved_channel_id TEXT;