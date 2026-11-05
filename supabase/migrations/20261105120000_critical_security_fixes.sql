-- =====================================================================
-- Critical security fixes (2026-11-05)
--
--  1. Users could grant themselves is_admin / is_approved.
--  2. Admin policies on profiles queried profiles from inside a profiles
--     policy (infinite recursion).
--  3. Anyone with the public anon key could read every active share token
--     and every lead / voice recap of every shared conference.
--  4. The meeting-transcripts bucket (business cards, voice recordings)
--     was public and listable by anyone; any user could write into any
--     other user's folder.
--  5. Collaborator policy compared cc.conference_id to cc.id (never matched).
--
-- Safe to run more than once. Written to work whether the database was
-- built from supabase/clean_schema.sql + schema_user_approval.sql or from
-- the migrations folder.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies can call them without
-- recursing through RLS on the same table)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_conference(conf_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conferences c WHERE c.id = conf_id AND c.created_by = uid)
      OR EXISTS (SELECT 1 FROM public.conference_collaborators cc
                 WHERE cc.conference_id = conf_id AND cc.user_id = uid);
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_conference(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_conference(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1 + 2. Profiles
-- ---------------------------------------------------------------------
-- Profiles are no longer readable by anonymous visitors.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Replace the recursive admin policies.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Own-profile updates must keep the same id.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only admins (or the service role / SQL editor, where auth.uid() is null)
-- may change is_admin or is_approved.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin_user(auth.uid())
     AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin
          OR NEW.is_approved IS DISTINCT FROM OLD.is_approved) THEN
    RAISE EXCEPTION 'Only admins can change admin or approval status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- 3. Share links: no direct anonymous table access. Shared pages go
--    through get_shared_conference(token), which checks the exact token.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read active share links" ON public.conference_share_links;
DROP POLICY IF EXISTS "Public can view recaps via share link" ON public.conference_voice_recaps;
DROP POLICY IF EXISTS "Public can view leads via share link" ON public.conference_leads;

-- New links expire after 30 days by default; existing open-ended links
-- get 30 days from now instead of living forever.
ALTER TABLE public.conference_share_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');
UPDATE public.conference_share_links
  SET expires_at = now() + interval '30 days'
  WHERE expires_at IS NULL AND is_active = true;

CREATE OR REPLACE FUNCTION public.get_shared_conference(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conf_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT sl.conference_id INTO v_conf_id
  FROM public.conference_share_links sl
  WHERE sl.token = p_token
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > now());

  IF v_conf_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only the fields the shared page displays. No emails, phone numbers,
  -- card images or audio.
  RETURN jsonb_build_object(
    'conference', (
      SELECT jsonb_build_object(
        'id', c.id, 'name', c.name, 'location', c.location,
        'start_date', c.start_date, 'end_date', c.end_date,
        'description', c.description, 'tags', c.tags,
        'exec_summary', c.exec_summary)
      FROM public.conferences c WHERE c.id = v_conf_id),
    'leads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'contact_name', l.contact_name, 'company', l.company,
        'title', l.title, 'notes', l.notes, 'status', l.status)
        ORDER BY l.created_at DESC)
      FROM public.conference_leads l WHERE l.conference_id = v_conf_id), '[]'::jsonb),
    'recaps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'created_at', r.created_at,
        'ai_summary', r.ai_summary, 'transcript', r.transcript,
        'recorded_by_name', p.full_name,
        'lead_contact_name', l.contact_name)
        ORDER BY r.created_at DESC)
      FROM public.conference_voice_recaps r
      LEFT JOIN public.profiles p ON p.id = r.recorded_by
      LEFT JOIN public.conference_leads l ON l.id = r.lead_id
      WHERE r.conference_id = v_conf_id), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_conference(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_conference(text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Storage: private bucket, uploads only into your own folder
--    ({user_id}/...), reads only for approved users via signed URLs.
-- ---------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'meeting-transcripts';

DROP POLICY IF EXISTS "Anyone can read meeting transcript files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: update own folder" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: approved users read" ON storage.objects;

CREATE POLICY "meeting-transcripts: upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-transcripts'
              AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meeting-transcripts: update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meeting-transcripts'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meeting-transcripts: delete own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-transcripts'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- Team members (approved users) can view each other's card images and
-- recordings, matching the app's shared-team model. Tighten to
-- per-organization once org_id exists.
CREATE POLICY "meeting-transcripts: approved users read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-transcripts'
         AND public.is_approved_user(auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Collaborator access (column was unqualified and matched cc.id)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Collaborators can view conferences" ON public.conferences;
DROP POLICY IF EXISTS "Conferences select own or collaborated" ON public.conferences;
CREATE POLICY "Collaborators can view conferences"
  ON public.conferences FOR SELECT TO authenticated
  USING (public.can_access_conference(conferences.id, auth.uid()));

-- ---------------------------------------------------------------------
-- 6. Inherited trigger that called send-calendar-invite on every new
--    calendar event using a hard-coded anon key for a different (old)
--    project. send-calendar-invite now requires a signed-in user, so the
--    trigger can only fail.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;
DROP FUNCTION IF EXISTS public.trigger_send_calendar_invite();
