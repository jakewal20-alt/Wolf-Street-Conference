
-- Add RLS policy for viewing shared BD pipeline snapshots
CREATE POLICY "Users can view shared pipeline snapshots"
ON public.bd_meeting_pipeline_snapshots
FOR SELECT
USING (has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Add RLS policy for viewing items in shared pipeline snapshots
CREATE POLICY "Users can view items in shared pipeline snapshots"
ON public.bd_meeting_pipeline_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bd_meeting_pipeline_snapshots s
    WHERE s.id = bd_meeting_pipeline_items.snapshot_id
    AND has_shared_access(auth.uid(), s.user_id, 'pipeline')
  )
);

-- Create notifications table for share alerts
CREATE TABLE public.share_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  share_type TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.share_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.share_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.share_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.share_notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can insert notifications (when sharing)
CREATE POLICY "Admins can insert notifications"
ON public.share_notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create trigger to auto-notify when a share is created
CREATE OR REPLACE FUNCTION public.notify_on_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.share_notifications (user_id, from_user_id, share_type, message)
  VALUES (
    NEW.shared_with_user_id,
    NEW.owner_user_id,
    NEW.share_type,
    CASE NEW.share_type
      WHEN 'pipeline' THEN 'You now have access to a shared BD Pipeline'
      WHEN 'brain' THEN 'You now have access to shared AI Brain data'
      WHEN 'conferences' THEN 'You now have access to shared Conferences'
      ELSE 'You have been granted shared access'
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_share_created
AFTER INSERT ON public.user_data_shares
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_share();
