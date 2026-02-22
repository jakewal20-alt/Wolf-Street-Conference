-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.bd_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  notify_health_changes BOOLEAN DEFAULT true,
  notify_due_dates BOOLEAN DEFAULT true,
  due_date_warning_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create notification history table
CREATE TABLE IF NOT EXISTS public.bd_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('health_change', 'due_date_warning')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.bd_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_notification_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their notification preferences"
  ON public.bd_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their notification history"
  ON public.bd_notification_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_bd_notification_history_user_id ON public.bd_notification_history(user_id);
CREATE INDEX idx_bd_notification_history_sent_at ON public.bd_notification_history(sent_at);

-- Function to notify on health status change
CREATE OR REPLACE FUNCTION notify_health_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if health actually changed and isn't 'none'
  IF (OLD.health IS DISTINCT FROM NEW.health) AND NEW.health != 'none' THEN
    -- Insert a notification job (the edge function will process these)
    INSERT INTO public.bd_notification_history (user_id, opportunity_id, notification_type, details)
    SELECT 
      o.user_id,
      NEW.opportunity_id,
      'health_change',
      jsonb_build_object(
        'old_health', OLD.health,
        'new_health', NEW.health,
        'opportunity_name', o.name,
        'summary', NEW.summary
      )
    FROM public.bd_opportunities o
    WHERE o.id = NEW.opportunity_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for health changes
CREATE TRIGGER bd_opportunity_health_change_trigger
  AFTER UPDATE ON public.bd_opportunity_status
  FOR EACH ROW
  EXECUTE FUNCTION notify_health_status_change();

-- Trigger to update updated_at
CREATE TRIGGER update_bd_notification_preferences_updated_at
  BEFORE UPDATE ON public.bd_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();