-- Add registration_url column to calendar_events table
ALTER TABLE public.calendar_events 
ADD COLUMN registration_url text;