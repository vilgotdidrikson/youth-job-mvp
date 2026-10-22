-- PostgreSQL OR-combines permissive policies. This legacy FOR ALL policy only
-- checked row ownership, so it bypassed the newer INSERT/UPDATE requirements
-- that the job is active and the youth has completed a CV.
drop policy if exists "swipe_actions youth own" on public.swipe_actions;

-- The explicit policies remain authoritative:
--   "swipes youth read own"
--   "swipes youth delete own"
--   "swipes youth insert active job"
--   "swipes youth update active job"
