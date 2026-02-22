-- Backfill known pursuits (ARES, WARMIX, ATM, IBCS)
-- Set is_user_pursuit = TRUE for existing opportunities that are known pursuits
UPDATE public.opportunities
SET is_user_pursuit = TRUE
WHERE (
  title ILIKE '%ARES%'
  OR title ILIKE '%WARMIX%'
  OR title ILIKE '%ATM%'
  OR title ILIKE '%IBCS%'
)
AND is_user_pursuit = FALSE;