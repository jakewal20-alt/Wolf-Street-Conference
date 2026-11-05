-- =====================================================================
-- Security round 2 (2026-11-06)
--
--  1. Leads: a user could insert a lead into ANY conference by ID (the
--     policy only checked created_by). Inserts now require access to the
--     conference (owner or collaborator).
--  2. Conference attendees: any signed-in user, even unapproved, could
--     add/remove/edit attendees on any conference. Writes now require
--     conference access; reads require an approved account.
--  3. Anonymous (logged-out) access: the public key could read/write any
--     table whose policy happened to allow it (several inherited Sam Scan
--     tables use USING (true)). Nothing in Wolf Street needs anonymous
--     table access — the shared page uses get_shared_conference() — so
--     revoke it wholesale.
--
-- Requires 20261105120000_critical_security_fixes.sql (helper functions).
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. conference_leads
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own conference leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can create their own conference leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can insert leads for owned or shared conferences" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can update their own conference leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can delete their own conference leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Leads: insert into accessible conference" ON public.conference_leads;
DROP POLICY IF EXISTS "Leads: view own" ON public.conference_leads;
DROP POLICY IF EXISTS "Leads: update own" ON public.conference_leads;
DROP POLICY IF EXISTS "Leads: delete own" ON public.conference_leads;

CREATE POLICY "Leads: insert into accessible conference"
  ON public.conference_leads FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND public.can_access_conference(conference_id, auth.uid()));

CREATE POLICY "Leads: view own"
  ON public.conference_leads FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Leads: update own"
  ON public.conference_leads FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid()
              AND public.can_access_conference(conference_id, auth.uid()));

CREATE POLICY "Leads: delete own"
  ON public.conference_leads FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Conference owners/collaborators already see every lead in their
-- conferences via the existing "Conference owners can view all leads" /
-- "Collaborators can view all conference leads" / "...owned or shared..."
-- SELECT policies, which are left in place.

-- ---------------------------------------------------------------------
-- 2. conference_attendees
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view conference attendees" ON public.conference_attendees;
DROP POLICY IF EXISTS "Authenticated users can add conference attendees" ON public.conference_attendees;
DROP POLICY IF EXISTS "Authenticated users can delete conference attendees" ON public.conference_attendees;
DROP POLICY IF EXISTS "Authenticated users can update conference attendees" ON public.conference_attendees;
DROP POLICY IF EXISTS "Attendees: approved users view" ON public.conference_attendees;
DROP POLICY IF EXISTS "Attendees: manage on accessible conference" ON public.conference_attendees;

-- Everyone on the (approved) team can see who is going where — this powers
-- the attendee avatars on the shared team calendar.
CREATE POLICY "Attendees: approved users view"
  ON public.conference_attendees FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

-- Tagging/untagging requires access to the conference. Approved users may
-- also add or remove THEMSELVES ("I'm attending").
CREATE POLICY "Attendees: manage on accessible conference"
  ON public.conference_attendees FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid())
         AND (public.can_access_conference(conference_id, auth.uid())
              OR user_id = auth.uid()))
  WITH CHECK (public.is_approved_user(auth.uid())
              AND (public.can_access_conference(conference_id, auth.uid())
                   OR user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 3. No anonymous table access
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- The shared conference page still works: it only calls this function.
GRANT EXECUTE ON FUNCTION public.get_shared_conference(text) TO anon;
