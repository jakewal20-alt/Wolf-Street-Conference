-- Conference Attendees: track which users are attending each conference
CREATE TABLE public.conference_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conference_id, user_id)
);

-- RLS: any authenticated user can read, insert, delete attendees
ALTER TABLE public.conference_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view conference attendees"
  ON public.conference_attendees FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can add conference attendees"
  ON public.conference_attendees FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete conference attendees"
  ON public.conference_attendees FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update conference attendees"
  ON public.conference_attendees FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_conference_attendees_conference ON public.conference_attendees(conference_id);
CREATE INDEX idx_conference_attendees_user ON public.conference_attendees(user_id);
