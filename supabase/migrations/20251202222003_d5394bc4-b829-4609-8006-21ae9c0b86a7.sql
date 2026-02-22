-- Create brain_settings table for AI Brain configuration
CREATE TABLE public.brain_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  writing_style TEXT DEFAULT '',
  brain_summary TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.brain_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own brain settings"
ON public.brain_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_brain_settings_updated_at
BEFORE UPDATE ON public.brain_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();