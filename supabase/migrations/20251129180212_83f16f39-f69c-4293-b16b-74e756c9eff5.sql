-- Drop the overly restrictive SELECT policy on knowledge_base
DROP POLICY IF EXISTS "Users can view their own knowledge base" ON public.knowledge_base;

-- Create a new SELECT policy that allows authenticated users to view all knowledge_base entries
CREATE POLICY "Authenticated users can view all knowledge base"
  ON public.knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep the restrictive INSERT/UPDATE/DELETE policies so users can only modify their own entries
-- (Those policies already exist and are correctly scoped to auth.uid() = user_id)