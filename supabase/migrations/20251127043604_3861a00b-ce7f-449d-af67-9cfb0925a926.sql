-- Create federal_news table
CREATE TABLE IF NOT EXISTS public.federal_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_federal_news_published_at ON public.federal_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_federal_news_source ON public.federal_news(source);

-- Create agency_updates table
CREATE TABLE IF NOT EXISTS public.agency_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  content TEXT,
  update_type TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_agency_updates_published_at ON public.agency_updates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_updates_agency ON public.agency_updates(agency);

-- Enable RLS
ALTER TABLE public.federal_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_updates ENABLE ROW LEVEL SECURITY;

-- Create policies - these are public intelligence data, viewable by all authenticated users
CREATE POLICY "Federal news are viewable by authenticated users" 
ON public.federal_news 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Agency updates are viewable by authenticated users" 
ON public.agency_updates 
FOR SELECT 
TO authenticated
USING (true);