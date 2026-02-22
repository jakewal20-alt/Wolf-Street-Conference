-- Create a helper function to check if user has ANY role (for access control)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Add UPDATE policy for user_roles (only admins can update)
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update opportunities table: require a role to access
DROP POLICY IF EXISTS "Users can view their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can view their own opportunities"
ON public.opportunities
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can insert their own opportunities"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can update their own opportunities"
ON public.opportunities
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own opportunities" ON public.opportunities;
CREATE POLICY "Users with roles can delete their own opportunities"
ON public.opportunities
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update contract_awards table: require a role to access
DROP POLICY IF EXISTS "Users can view their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can view their own contract awards"
ON public.contract_awards
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can insert their own contract awards"
ON public.contract_awards
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can update their own contract awards"
ON public.contract_awards
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own contract awards" ON public.contract_awards;
CREATE POLICY "Users with roles can delete their own contract awards"
ON public.contract_awards
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update knowledge_base table: require a role to access
DROP POLICY IF EXISTS "Users can view their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can view their own knowledge base entries"
ON public.knowledge_base
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can insert their own knowledge base entries"
ON public.knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can update their own knowledge base entries"
ON public.knowledge_base
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own knowledge base entries" ON public.knowledge_base;
CREATE POLICY "Users with roles can delete their own knowledge base entries"
ON public.knowledge_base
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

-- Update daily_briefs table: require a role to access
DROP POLICY IF EXISTS "Users can view their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can view their own briefs"
ON public.daily_briefs
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can insert their own briefs"
ON public.daily_briefs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own briefs" ON public.daily_briefs;
CREATE POLICY "Users with roles can update their own briefs"
ON public.daily_briefs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND has_any_role(auth.uid()))
WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid()));