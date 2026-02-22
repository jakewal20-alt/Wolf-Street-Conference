-- Fix infinite recursion in RLS policies for conferences and conference_collaborators
-- The issue is that conferences SELECT policy references conference_collaborators,
-- and conference_collaborators SELECT policy references conferences, causing a loop.

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view conferences they created or collaborate on" ON public.conferences;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Owners can manage collaborators" ON public.conference_collaborators;
DROP POLICY IF EXISTS "Collaborators can view shared conferences" ON public.conferences;

-- Recreate conference_collaborators policies WITHOUT referencing conferences table
CREATE POLICY "Users can view collaborations they are part of"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Owners can insert collaborators"
ON public.conference_collaborators
FOR INSERT
WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Owners can delete collaborators"
ON public.conference_collaborators
FOR DELETE
USING (invited_by = auth.uid());

-- Recreate conferences SELECT policy using a simple subquery that doesn't cause recursion
-- The key is to not have conference_collaborators policy depend on conferences
CREATE POLICY "Users can view own or collaborated conferences"
ON public.conferences
FOR SELECT
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conference_collaborators 
    WHERE conference_collaborators.conference_id = conferences.id 
    AND conference_collaborators.user_id = auth.uid()
  )
);