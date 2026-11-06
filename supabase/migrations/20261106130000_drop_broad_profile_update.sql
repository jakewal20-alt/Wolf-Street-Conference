-- Applied manually in the SQL editor on 2026-11-06; recorded here so the repo
-- matches production.
--
-- "Authenticated users can update profiles" (added outside the repo, likely by
-- a saved "Restore Broad Profile Update Access" query) let any signed-in user
-- edit anyone's name/email. Own-profile edits and admin approvals are covered
-- by "Users can update own profile" and "Admins can update all profiles".
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;
