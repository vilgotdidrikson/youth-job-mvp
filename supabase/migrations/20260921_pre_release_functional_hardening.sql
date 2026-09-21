-- Release hardening for direct job links, inactive-job applications and the
-- short youth onboarding path.

-- Discovery remains protected by the jobs RLS policy. This function exposes
-- one explicitly requested listing so an old direct URL can render its real
-- paused/closed state and block the application action in the UI.
create or replace function public.get_job_direct_detail(p_job_id uuid)
returns setof public.jobs
language sql
stable
security definer
set search_path = public
as $$
  select job.*
  from public.jobs job
  where job.id = p_job_id
    and (job.job_kind = 'employment' or job.company_user_id = auth.uid());
$$;
revoke all on function public.get_job_direct_detail(uuid) from public;
grant execute on function public.get_job_direct_detail(uuid) to anon, authenticated;

-- Preserve the existing candidate authorization boundary while exposing only
-- the structured experience and education needed by the candidate overview.
-- Do not return cv_structured wholesale: it may contain private contact data.
drop function if exists public.get_company_candidates(uuid);
create function public.get_company_candidates(p_job_id uuid)
returns table (
  user_id uuid,
  full_name text,
  age integer,
  city text,
  desired_roles text[],
  employment_preferences text[],
  strengths text[],
  work_experience text[],
  education text[],
  languages text[],
  cv_text text,
  work_experience_details jsonb,
  education_details jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_account() or not exists (
    select 1 from public.jobs where id = p_job_id and company_user_id = auth.uid()
  ) then
    raise exception 'Not allowed to view candidates for this job' using errcode = '42501';
  end if;

  return query
    select yp.user_id, yp.full_name, yp.age, yp.city, yp.desired_roles,
      yp.employment_preferences, yp.strengths, yp.work_experience, yp.education,
      yp.languages, yp.cv_text,
      coalesce(yp.cv_structured->'workExperience', '[]'::jsonb),
      coalesce(yp.cv_structured->'education', '[]'::jsonb)
    from public.youth_profiles yp
    join public.swipe_actions swipe on swipe.youth_user_id = yp.user_id
    where swipe.job_id = p_job_id and swipe.decision = 'interested';
end;
$$;
revoke all on function public.get_company_candidates(uuid) from public;
grant execute on function public.get_company_candidates(uuid) to authenticated;

-- Keep existing actions readable for their participants, but require an
-- active listing for every new or changed youth application decision.
drop policy if exists "swipes youth with completed cv" on public.swipe_actions;
drop policy if exists "swipes youth read own" on public.swipe_actions;
drop policy if exists "swipes youth insert active job" on public.swipe_actions;
drop policy if exists "swipes youth update active job" on public.swipe_actions;
drop policy if exists "swipes youth delete own" on public.swipe_actions;

create policy "swipes youth read own"
  on public.swipe_actions for select
  using (auth.uid() = youth_user_id);

create policy "swipes youth insert active job"
  on public.swipe_actions for insert
  with check (
    auth.uid() = youth_user_id
    and exists (
      select 1 from public.jobs job
      where job.id = swipe_actions.job_id and job.status = 'active' and job.is_active = true
    )
    and exists (
      select 1 from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and (
          coalesce(trim(youth_profile.cv_text), '') <> ''
          or youth_profile.cv_generated = true
          or youth_profile.cv_uploaded = true
          or exists (
            select 1
            from jsonb_array_elements(coalesce(youth_profile.documents, '[]'::jsonb)) document
            where document->>'type' in ('cv', 'generated_cv')
          )
        )
    )
  );

create policy "swipes youth update active job"
  on public.swipe_actions for update
  using (auth.uid() = youth_user_id)
  with check (
    auth.uid() = youth_user_id
    and exists (
      select 1 from public.jobs job
      where job.id = swipe_actions.job_id and job.status = 'active' and job.is_active = true
    )
    and exists (
      select 1 from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and (
          coalesce(trim(youth_profile.cv_text), '') <> ''
          or youth_profile.cv_generated = true
          or youth_profile.cv_uploaded = true
          or exists (
            select 1
            from jsonb_array_elements(coalesce(youth_profile.documents, '[]'::jsonb)) document
            where document->>'type' in ('cv', 'generated_cv')
          )
        )
    )
  );

create policy "swipes youth delete own"
  on public.swipe_actions for delete
  using (auth.uid() = youth_user_id);

-- A pre-CV application draft is still an application intent. Preserve old
-- drafts for the youth, while blocking inserts/updates after a listing closes.
drop policy if exists "youth application drafts own only" on public.youth_application_drafts;
drop policy if exists "youth application drafts read own" on public.youth_application_drafts;
drop policy if exists "youth application drafts insert active job" on public.youth_application_drafts;
drop policy if exists "youth application drafts update active job" on public.youth_application_drafts;
drop policy if exists "youth application drafts delete own" on public.youth_application_drafts;

create policy "youth application drafts read own"
  on public.youth_application_drafts for select
  using (auth.uid() = youth_user_id);

create policy "youth application drafts insert active job"
  on public.youth_application_drafts for insert
  with check (
    auth.uid() = youth_user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth')
    and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true)
    and exists (select 1 from public.jobs job where job.id = youth_application_drafts.job_id and job.status = 'active' and job.is_active = true)
  );

create policy "youth application drafts update active job"
  on public.youth_application_drafts for update
  using (auth.uid() = youth_user_id)
  with check (
    auth.uid() = youth_user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth')
    and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true)
    and exists (select 1 from public.jobs job where job.id = youth_application_drafts.job_id and job.status = 'active' and job.is_active = true)
  );

create policy "youth application drafts delete own"
  on public.youth_application_drafts for delete
  using (auth.uid() = youth_user_id);

-- Both onboarding variants require a trimmed, non-empty display name. NOT
-- VALID keeps deployment backward-safe for old rows while checking all future
-- inserts and updates immediately.
alter table public.youth_profiles
  drop constraint if exists youth_profiles_completed_requires_full_name;

alter table public.youth_profiles
  add constraint youth_profiles_completed_requires_full_name
  check (
    (onboarding_completed is not true and short_onboarding_completed is not true)
    or (full_name is not null and btrim(full_name) <> '')
  )
  not valid;
