-- Create table for SAM.gov RSS feed monitoring
CREATE TABLE IF NOT EXISTS public.sam_rss_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  agencies TEXT[] DEFAULT '{}',
  naics_codes TEXT[] DEFAULT '{}',
  notice_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sam_rss_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for RSS subscriptions
CREATE POLICY "Users can view their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RSS subscriptions"
  ON public.sam_rss_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_sam_rss_subscriptions_updated_at
  BEFORE UPDATE ON public.sam_rss_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();