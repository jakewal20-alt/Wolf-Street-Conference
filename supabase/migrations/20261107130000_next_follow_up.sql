-- =====================================================================
-- Next follow-up date (2026-11-07)
--
-- Hallway had no reliable "when do we follow up next" field. Adds one to
-- contacts and conference leads. The Wolf Street home page ("follow-ups
-- due") and Hallway's own UI read it.
--
-- Columns are covered by the tables' existing row-level security.
-- Safe to re-run.
-- =====================================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS next_follow_up_date date,
  ADD COLUMN IF NOT EXISTS next_follow_up_note text;

ALTER TABLE public.conference_leads
  ADD COLUMN IF NOT EXISTS next_follow_up_date date,
  ADD COLUMN IF NOT EXISTS next_follow_up_note text;

CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up
  ON public.contacts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conference_leads_next_follow_up
  ON public.conference_leads(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

-- Check: should return 4 rows.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('contacts', 'conference_leads')
  AND column_name IN ('next_follow_up_date', 'next_follow_up_note')
ORDER BY table_name, column_name;
