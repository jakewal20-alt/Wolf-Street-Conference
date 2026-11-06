-- =====================================================================
-- conference_speakers (2026-11-07)
--
-- Speakers / panelists for a conference, filled by the URL import
-- (ingest-conference-from-url) and readable by Forecast through the
-- read-only forecast-conferences function. Lets Forecast match the people
-- it tracks (program managers, sponsors) to where they will appear.
--
-- Access mirrors conferences: owner or collaborator (can_access_conference).
-- Requires 20261105120000_critical_security_fixes.sql. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.conference_speakers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  title         text,
  organization  text,
  session_title text,
  session_time  text,          -- as published ("Dec 2, 10:30 AM"); not normalized
  source_url    text,          -- page it was extracted from; NULL = added by hand
  extracted_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conference_speakers_conference
  ON public.conference_speakers(conference_id);
CREATE INDEX IF NOT EXISTS idx_conference_speakers_name
  ON public.conference_speakers(lower(name));

ALTER TABLE public.conference_speakers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Speakers: view on accessible conference" ON public.conference_speakers;
DROP POLICY IF EXISTS "Speakers: manage on accessible conference" ON public.conference_speakers;

CREATE POLICY "Speakers: view on accessible conference"
  ON public.conference_speakers FOR SELECT TO authenticated
  USING (public.can_access_conference(conference_id, auth.uid()));

CREATE POLICY "Speakers: manage on accessible conference"
  ON public.conference_speakers FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid())
         AND public.can_access_conference(conference_id, auth.uid()))
  WITH CHECK (public.is_approved_user(auth.uid())
              AND public.can_access_conference(conference_id, auth.uid()));

-- No anonymous access (matches the rest of the schema).
REVOKE ALL ON public.conference_speakers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conference_speakers TO authenticated;
