-- =====================================================================
-- Companies (multi-tenancy), 2026-11-08
--
-- Every Hallway record now belongs to one company (organizations.id).
-- Approved people see and edit everything in their own company and
-- nothing outside it. Decisions (Jake, 2026-11-08):
--   * one company per person
--   * whole-company visibility inside a company
--   * the platform admin creates companies and invites their first admin;
--     company admins invite and approve people into their own company only
--   * existing data belongs to MAVRC; only admins and people who own
--     Hallway records keep access (re-invite anyone else)
--
-- Also closes these holes:
--   * "shared_*" policies let ANY signed-in Wolf Street account (including
--     people never approved for Hallway) read and edit all Hallway data
--   * new accounts were auto-approved by handle_new_user
--   * storage files were readable by every approved user
--
-- Run the whole file in the Supabase SQL editor. Safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Companies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

INSERT INTO public.organizations (name, slug)
VALUES ('MAVRC', 'mavrc')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. People: company + platform admin flag
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles (org_id);

-- ---------------------------------------------------------------------
-- 2b. org_id on every Hallway table, backfilled to MAVRC
--     (before the helper functions, which reference it)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  mavrc uuid := (SELECT id FROM public.organizations WHERE slug = 'mavrc');
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conferences', 'conference_leads', 'conference_speakers', 'conference_attendees',
    'conference_collaborators', 'conference_share_links', 'conference_voice_recaps',
    'calendar_events', 'contacts', 'touchpoints'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT', t);
    EXECUTE format('UPDATE public.%I SET org_id = $1 WHERE org_id IS NULL', t) USING mavrc;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_id_idx', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER: policies call them without
--    recursing through profiles' own RLS)
-- ---------------------------------------------------------------------
-- The caller's company, only if they're approved for Hallway.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles
  WHERE id = auth.uid() AND is_approved = true AND org_id IS NOT NULL;
$$;

-- Approved for Hallway = approved AND in a company.
CREATE OR REPLACE FUNCTION public.is_approved_user(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_approved AND org_id IS NOT NULL
                   FROM public.profiles WHERE id = uid), false);
$$;

-- Company admin (of their own company).
CREATE OR REPLACE FUNCTION public.is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin AND is_approved AND org_id IS NOT NULL
                   FROM public.profiles WHERE id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_platform_admin FROM public.profiles WHERE id = uid), false);
$$;

-- Same company as the conference (whole-company visibility).
CREATE OR REPLACE FUNCTION public.can_access_conference(conf_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conferences c
    JOIN public.profiles p ON p.id = uid
    WHERE c.id = conf_id
      AND p.is_approved = true
      AND p.org_id IS NOT NULL
      AND c.org_id = p.org_id
  );
$$;

-- Is this user (id as text, e.g. a storage folder name) in my company?
CREATE OR REPLACE FUNCTION public.user_in_my_org(uid_text text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id::text = uid_text
      AND p.org_id IS NOT NULL
      AND p.org_id = public.current_org_id()
  );
$$;

-- Service-role helper for admin-invite-user: find an account by email,
-- including suite accounts that have no Hallway profile yet.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_conference(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_in_my_org(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_conference(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_my_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;

-- ---------------------------------------------------------------------
-- 4. Existing people -> MAVRC. The current admin becomes platform admin.
-- ---------------------------------------------------------------------
-- (Old trigger silently undid is_admin/is_approved changes made from the
-- SQL editor; drop it first. Replaced in section 7.)
DROP TRIGGER IF EXISTS protect_admin_fields_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_admin_fields();

-- First run only (skipped once anyone has a company, so people removed later
-- aren't put back). Only real Hallway users join MAVRC: admins and anyone
-- who owns Hallway records. Every other profile (the old trigger approved
-- every new suite account) loses Hallway access until an admin invites them;
-- inviting an existing account adds it immediately.
DO $$
DECLARE mavrc uuid := (SELECT id FROM public.organizations WHERE slug = 'mavrc');
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE org_id IS NOT NULL) THEN
    RETURN;
  END IF;

  UPDATE public.profiles p
  SET org_id = mavrc
  WHERE p.is_approved = true AND (
       p.is_admin = true
    OR EXISTS (SELECT 1 FROM public.conferences x WHERE x.created_by = p.id)
    OR EXISTS (SELECT 1 FROM public.conference_leads x WHERE x.created_by = p.id)
    OR EXISTS (SELECT 1 FROM public.calendar_events x WHERE x.user_id = p.id)
    OR EXISTS (SELECT 1 FROM public.contacts x WHERE x.user_id = p.id)
    OR EXISTS (SELECT 1 FROM public.touchpoints x WHERE x.user_id = p.id)
    OR EXISTS (SELECT 1 FROM public.conference_collaborators x WHERE x.user_id = p.id));

  UPDATE public.profiles
  SET is_approved = false, is_admin = false
  WHERE org_id IS NULL;

  -- Exactly one platform admin: the earliest admin.
  UPDATE public.profiles SET is_platform_admin = true
  WHERE id = (SELECT id FROM public.profiles
              WHERE is_admin = true AND org_id IS NOT NULL
              ORDER BY created_at NULLS LAST, id LIMIT 1);
END $$;

-- New accounts (any Wolf Street app) are NOT Hallway members until invited.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Stamp org_id on write; it can never be changed by a user.
--    Signed-in users: always their own company.
--    Service role (edge functions, SQL editor): taken from the row's
--    conference, else from its creator/owner.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_org_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row_json jsonb := to_jsonb(NEW);
  owner_json jsonb := '{}'::jsonb;
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.org_id := OLD.org_id;
    -- Owners can't be reassigned by users either.
    IF auth.uid() IS NOT NULL AND TG_NARGS > 0 THEN
      FOR i IN 0 .. TG_NARGS - 1 LOOP
        owner_json := owner_json || jsonb_build_object(TG_ARGV[i], to_jsonb(OLD) -> TG_ARGV[i]);
      END LOOP;
      NEW := jsonb_populate_record(NEW, owner_json);
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_org := public.current_org_id();
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'Your account is not part of a Hallway company' USING ERRCODE = '42501';
    END IF;
    NEW.org_id := v_org;
    -- Owner columns (trigger arguments) are always the caller, so nobody
    -- can plant rows under someone else's name.
    IF TG_NARGS > 0 THEN
      FOR i IN 0 .. TG_NARGS - 1 LOOP
        owner_json := owner_json || jsonb_build_object(TG_ARGV[i], auth.uid());
      END LOOP;
      NEW := jsonb_populate_record(NEW, owner_json);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.org_id IS NULL AND row_json ? 'conference_id' THEN
    SELECT org_id INTO v_org FROM public.conferences
    WHERE id = (row_json->>'conference_id')::uuid;
    NEW.org_id := v_org;
  END IF;
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO v_org FROM public.profiles
    WHERE id = COALESCE(row_json->>'created_by', row_json->>'user_id', row_json->>'recorded_by')::uuid;
    NEW.org_id := v_org;
  END IF;
  -- Still NULL: the NOT NULL constraint rejects the row.
  RETURN NEW;
END;
$$;

-- table => owner column set to the signed-in caller on insert
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('conferences', 'created_by'),
    ('conference_leads', 'created_by'),
    ('conference_speakers', 'created_by'),
    ('conference_share_links', 'created_by'),
    ('conference_voice_recaps', 'recorded_by'),
    ('conference_attendees', 'added_by'),
    ('conference_collaborators', 'invited_by'),
    ('calendar_events', 'user_id'),
    ('contacts', 'user_id'),
    ('touchpoints', 'user_id')
  ) AS v(t, owner_col) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS stamp_org_id ON public.%I', r.t);
    EXECUTE format('CREATE TRIGGER stamp_org_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_org_id(%L)', r.t, r.owner_col);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. Profile privileges
--    - users: may edit their own name etc., never is_admin / is_approved /
--      org_id / is_platform_admin
--    - company admins: approve, revoke, promote people in their company
--    - platform admin: also move people between companies
--    - SQL editor / service role (auth.uid() is null): anything
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email can''t be changed here' USING ERRCODE = '42501';
  END IF;

  IF OLD.is_platform_admin AND NOT public.is_platform_admin(me) THEN
    RAISE EXCEPTION 'Only the platform admin can change this account' USING ERRCODE = '42501';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id AND NOT public.is_platform_admin(me) THEN
    RAISE EXCEPTION 'Only the platform admin can move people between companies' USING ERRCODE = '42501';
  END IF;

  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.is_approved IS DISTINCT FROM OLD.is_approved) THEN
    IF NEW.id = me THEN
      RAISE EXCEPTION 'You can''t change your own access' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_platform_admin(me)
            OR (public.is_admin_user(me) AND OLD.org_id = public.current_org_id())) THEN
      RAISE EXCEPTION 'Only admins of this company can change access' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- 8. Row-level security: drop every old policy on these tables and
--    replace with company-only access.
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'organizations', 'profiles',
      'conferences', 'conference_leads', 'conference_speakers', 'conference_attendees',
      'conference_collaborators', 'conference_share_links', 'conference_voice_recaps',
      'calendar_events', 'contacts', 'touchpoints')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Companies: members see their own; the platform admin sees and creates all.
CREATE POLICY "Companies: members view own"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Companies: platform admin creates"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Companies: platform admin renames"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Profiles: yourself, your company, or everything for the platform admin.
-- No client inserts or deletes (the sign-up trigger and edge functions do those).
CREATE POLICY "Profiles: view self, company, or all (platform admin)"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid()
         OR (org_id IS NOT NULL AND org_id = public.current_org_id())
         OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Profiles: update self"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: company admins update their company"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Profiles: platform admin updates all"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Tables with no cross-references to check.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conferences', 'calendar_events', 'contacts'] LOOP
    EXECUTE format($p$
      CREATE POLICY "Company members" ON public.%I FOR ALL TO authenticated
      USING (org_id = public.current_org_id())
      WITH CHECK (org_id = public.current_org_id())
    $p$, t);
  END LOOP;
END $$;

-- Rows hanging off a conference: the conference must be in your company too.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conference_leads', 'conference_speakers', 'conference_share_links'] LOOP
    EXECUTE format($p$
      CREATE POLICY "Company members" ON public.%I FOR ALL TO authenticated
      USING (org_id = public.current_org_id())
      WITH CHECK (org_id = public.current_org_id()
                  AND public.can_access_conference(conference_id, auth.uid()))
    $p$, t);
  END LOOP;
END $$;

-- Recaps: conference (and the lead, if any) in your company.
CREATE POLICY "Company members" ON public.conference_voice_recaps FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id()
              AND public.can_access_conference(conference_id, auth.uid())
              AND (lead_id IS NULL OR EXISTS (
                SELECT 1 FROM public.conference_leads l
                WHERE l.id = lead_id AND l.org_id = public.current_org_id())));

-- Attendees and collaborators: the person added must be in your company.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conference_attendees', 'conference_collaborators'] LOOP
    EXECUTE format($p$
      CREATE POLICY "Company members" ON public.%I FOR ALL TO authenticated
      USING (org_id = public.current_org_id())
      WITH CHECK (org_id = public.current_org_id()
                  AND public.can_access_conference(conference_id, auth.uid())
                  AND public.user_in_my_org(user_id::text))
    $p$, t);
  END LOOP;
END $$;

-- Touchpoints: the contact must be in your company.
CREATE POLICY "Company members" ON public.touchpoints FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id()
              AND EXISTS (SELECT 1 FROM public.contacts c
                          WHERE c.id = contact_id AND c.org_id = public.current_org_id()));

-- ---------------------------------------------------------------------
-- 9. Storage: card images and recordings readable only inside the
--    uploader's company (files live under {user_id}/...).
-- ---------------------------------------------------------------------
-- A file belongs to the company whose lead/recap points at it, so files
-- stay with the company when the uploader moves or is removed. Files not
-- (yet) attached to a record follow the uploader's company.
CREATE OR REPLACE FUNCTION public.file_in_my_org(object_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_org_id() IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.conference_leads l
               WHERE l.org_id = public.current_org_id()
                 AND position('/meeting-transcripts/' || object_name IN l.card_image_url) > 0)
    OR EXISTS (SELECT 1 FROM public.conference_voice_recaps r
               WHERE r.org_id = public.current_org_id()
                 AND position('/meeting-transcripts/' || object_name IN r.audio_url) > 0)
    OR public.user_in_my_org((string_to_array(object_name, '/'))[1]));
$$;
REVOKE ALL ON FUNCTION public.file_in_my_org(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.file_in_my_org(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "meeting-transcripts: approved users read" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: company members read" ON storage.objects;
CREATE POLICY "meeting-transcripts: company members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-transcripts' AND public.file_in_my_org(name));

-- Only Hallway members may write (own folder only, as before).
DROP POLICY IF EXISTS "meeting-transcripts: upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: update own folder" ON storage.objects;
DROP POLICY IF EXISTS "meeting-transcripts: delete own folder" ON storage.objects;
CREATE POLICY "meeting-transcripts: upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-transcripts'
              AND public.is_approved_user(auth.uid())
              AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "meeting-transcripts: update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meeting-transcripts'
         AND public.is_approved_user(auth.uid())
         AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "meeting-transcripts: delete own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-transcripts'
         AND public.is_approved_user(auth.uid())
         AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;

-- ---------------------------------------------------------------------
-- Check (should show MAVRC with every row counted, 0 rows without a company,
-- and exactly one platform admin)
-- ---------------------------------------------------------------------
SELECT o.name AS company,
  (SELECT count(*) FROM public.profiles p WHERE p.org_id = o.id) AS people,
  (SELECT count(*) FROM public.conferences c WHERE c.org_id = o.id) AS conferences,
  (SELECT count(*) FROM public.conference_leads l WHERE l.org_id = o.id) AS leads,
  (SELECT count(*) FROM public.calendar_events e WHERE e.org_id = o.id) AS calendar_events,
  (SELECT count(*) FROM public.contacts c WHERE c.org_id = o.id) AS contacts,
  (SELECT count(*) FROM public.profiles WHERE is_platform_admin) AS platform_admins
FROM public.organizations o;
