-- Fix 1: Companies need to read swipe_actions for jobs they own so candidates appear.
-- The existing policy only lets the youth read their own rows.
create policy "swipe_actions company read own jobs"
  on public.swipe_actions for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.company_user_id = auth.uid()
    )
  );

-- Fix 2: Companies need to read youth_profiles to see candidate details.
-- The existing policy only lets youth read their own row.
create policy "youth_profiles read all authenticated"
  on public.youth_profiles for select
  using (auth.role() = 'authenticated');

-- Fix 3: Youth need to read company_profiles to see company names in chats.
-- The existing policy only lets companies read their own row.
create policy "company_profiles read all authenticated"
  on public.company_profiles for select
  using (auth.role() = 'authenticated');
