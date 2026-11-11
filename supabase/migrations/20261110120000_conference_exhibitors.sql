-- =====================================================================
-- conference_exhibitors (2026-11-10)
--
-- Companies exhibiting at a conference, with their booth, filled by the
-- import-exhibitors function (a directory URL or text pasted from it).
-- Floor Mode matches them against your contacts, leads, speakers and the
-- organizations on your Forecast pursuits: "booths to visit".
--
-- Access mirrors conference_speakers: anyone who can access the conference.
-- can_access_conference is company-aware once 20261108120000_companies.sql
-- runs, so this is safe to run before or after it. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.conference_exhibitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  booth         text,          -- as published ("1301", "MR2916"); one row per booth
  source_url    text,          -- directory it came from; NULL = added by hand
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conference_exhibitors_booth
  ON public.conference_exhibitors(conference_id, lower(name), coalesce(booth, ''));
CREATE INDEX IF NOT EXISTS idx_conference_exhibitors_conference
  ON public.conference_exhibitors(conference_id);

ALTER TABLE public.conference_exhibitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Exhibitors: view on accessible conference" ON public.conference_exhibitors;
DROP POLICY IF EXISTS "Exhibitors: manage on accessible conference" ON public.conference_exhibitors;

CREATE POLICY "Exhibitors: view on accessible conference"
  ON public.conference_exhibitors FOR SELECT TO authenticated
  USING (public.can_access_conference(conference_id, auth.uid()));

CREATE POLICY "Exhibitors: manage on accessible conference"
  ON public.conference_exhibitors FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid())
         AND public.can_access_conference(conference_id, auth.uid()))
  WITH CHECK (public.is_approved_user(auth.uid())
              AND public.can_access_conference(conference_id, auth.uid()));

REVOKE ALL ON public.conference_exhibitors FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conference_exhibitors TO authenticated;
