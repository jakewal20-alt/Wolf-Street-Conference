-- Create user_data_shares table to track what data is shared with whom
CREATE TABLE public.user_data_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type text NOT NULL CHECK (share_type IN ('brain', 'conferences', 'pipeline')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (owner_user_id, shared_with_user_id, share_type)
);

-- Enable RLS
ALTER TABLE public.user_data_shares ENABLE ROW LEVEL SECURITY;

-- Only admins can manage shares
CREATE POLICY "Admins can manage all shares"
ON public.user_data_shares
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view shares they're involved in
CREATE POLICY "Users can view their shares"
ON public.user_data_shares
FOR SELECT
USING (auth.uid() = owner_user_id OR auth.uid() = shared_with_user_id);

-- Create helper function to check if user has read access to another user's data
CREATE OR REPLACE FUNCTION public.has_shared_access(
  _viewer_user_id uuid,
  _owner_user_id uuid,
  _share_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_data_shares
    WHERE owner_user_id = _owner_user_id
      AND shared_with_user_id = _viewer_user_id
      AND share_type = _share_type
  )
$$;

-- Update brain_settings RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their own brain settings" ON public.brain_settings;

CREATE POLICY "Users can view own or shared brain settings"
ON public.brain_settings
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'brain')
);

CREATE POLICY "Users can manage their own brain settings"
ON public.brain_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update company_capabilities RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their capabilities" ON public.company_capabilities;

CREATE POLICY "Users can view own or shared capabilities"
ON public.company_capabilities
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'brain')
);

CREATE POLICY "Users can manage their own capabilities"
ON public.company_capabilities
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update knowledge_base RLS to allow shared read access (for brain type)
CREATE POLICY "Users can view shared knowledge base"
ON public.knowledge_base
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'brain'));

-- Update conferences RLS to allow shared read access
DROP POLICY IF EXISTS "Users can view their own conferences" ON public.conferences;

CREATE POLICY "Users can view own or shared conferences"
ON public.conferences
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.has_shared_access(auth.uid(), created_by, 'conferences')
);

-- Update conference_leads RLS to allow shared read access
DROP POLICY IF EXISTS "Users can view their own conference leads" ON public.conference_leads;

CREATE POLICY "Users can view own or shared conference leads"
ON public.conference_leads
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.has_shared_access(auth.uid(), created_by, 'conferences')
);

-- Update calendar_events RLS to allow shared read access
DROP POLICY IF EXISTS "Users can manage their calendar events" ON public.calendar_events;

CREATE POLICY "Users can view own or shared calendar events"
ON public.calendar_events
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_shared_access(auth.uid(), user_id, 'conferences')
);

CREATE POLICY "Users can manage their own calendar events"
ON public.calendar_events
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update opportunities RLS to allow shared read access for pipeline
CREATE POLICY "Users can view shared opportunities"
ON public.opportunities
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'pipeline'));

-- Update contract_awards RLS to allow shared read access for pipeline
CREATE POLICY "Users can view shared contract awards"
ON public.contract_awards
FOR SELECT
USING (public.has_shared_access(auth.uid(), user_id, 'pipeline'));