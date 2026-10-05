-- Security-definer functions must never rely on PostgreSQL's default PUBLIC
-- EXECUTE grant. Keep only the two explicitly public read RPCs anonymous;
-- application and admin RPCs require an authenticated session, while trigger
-- helpers remain callable only by trusted backend roles.

-- The policies below perform account-type checks and can only be meaningful
-- for signed-in users. Scoping them prevents anonymous queries from needing
-- EXECUTE on the account helper functions.
alter policy "jobs company insert" on public.jobs to authenticated;
alter policy "jobs company update" on public.jobs to authenticated;
alter policy "jobs company delete" on public.jobs to authenticated;
alter policy "matches owner update non_hire_lifecycle" on public.matches to authenticated;
alter policy "youth profiles own insert" on public.youth_profiles to authenticated;
alter policy "youth profiles own update" on public.youth_profiles to authenticated;
alter policy "youth profiles own delete" on public.youth_profiles to authenticated;

-- Trigger-only helpers.
revoke all on function public.create_mvp_notification() from public, anon, authenticated;
revoke all on function public.enforce_company_active_job_limit() from public, anon, authenticated;
revoke all on function public.touch_conversation_after_message() from public, anon, authenticated;
grant execute on function public.create_mvp_notification() to service_role;
grant execute on function public.enforce_company_active_job_limit() to service_role;
grant execute on function public.touch_conversation_after_message() to service_role;

-- Account predicates are used by authenticated RLS policies and protected RPCs.
revoke all on function public.is_company_account(uuid) from public, anon, authenticated;
revoke all on function public.is_youth_account(uuid) from public, anon, authenticated;
grant execute on function public.is_company_account(uuid) to authenticated, service_role;
grant execute on function public.is_youth_account(uuid) to authenticated, service_role;

-- Signed-in application RPCs.
revoke all on function public.consume_api_quota(text, integer) from public, anon, authenticated;
revoke all on function public.get_company_candidates(uuid) from public, anon, authenticated;
revoke all on function public.get_my_conversation_contacts() from public, anon, authenticated;
revoke all on function public.mark_match_hired(uuid) from public, anon, authenticated;
revoke all on function public.review_candidate_and_match(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_api_quota(text, integer) to authenticated, service_role;
grant execute on function public.get_company_candidates(uuid) to authenticated, service_role;
grant execute on function public.get_my_conversation_contacts() to authenticated, service_role;
grant execute on function public.mark_match_hired(uuid) to authenticated, service_role;
grant execute on function public.review_candidate_and_match(uuid, uuid, text) to authenticated, service_role;

-- These two RPCs intentionally expose filtered, non-sensitive job data to the
-- public feed. State their grants explicitly so future function replacements
-- cannot broaden access by accident.
revoke all on function public.get_job_direct_detail(uuid) from public, anon, authenticated;
revoke all on function public.premium_effective_boosts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_job_direct_detail(uuid) to anon, authenticated, service_role;
grant execute on function public.premium_effective_boosts(uuid[]) to anon, authenticated, service_role;
