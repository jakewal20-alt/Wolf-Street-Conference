-- Add invite_email column to calendar_events for sending invites to specific recipients
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS invite_email TEXT;