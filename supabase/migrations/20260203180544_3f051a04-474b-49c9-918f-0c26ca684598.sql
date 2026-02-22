-- Clean up ALL old/duplicate/recursive policies causing infinite recursion

-- Drop ALL existing policies on conference_collaborators
DROP POLICY IF EXISTS "Conference owners can manage collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can delete collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can insert collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Users can view collaborations they are part of" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Users can view their collaborations" ON public.conference_collaborators;

-- Drop ALL existing SELECT policies on conferences (keeping INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Users can view own or collaborated conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can view own or shared conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can view owned or shared conferences" ON public.conferences;

-- Recreate clean conference_collaborators policies (NO references to conferences table)
CREATE POLICY "Collaborators select own records"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Collaborators insert by inviter"
ON public.conference_collaborators
FOR INSERT
WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Collaborators delete by inviter"
ON public.conference_collaborators
FOR DELETE
USING (invited_by = auth.uid());

-- Recreate clean conferences SELECT policy (this queries conference_collaborators which no longer queries back)
CREATE POLICY "Conferences select own or collaborated"
ON public.conferences
FOR SELECT
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conference_collaborators cc
    WHERE cc.conference_id = id 
    AND cc.user_id = auth.uid()
  )
);