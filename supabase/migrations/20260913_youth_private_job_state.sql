-- Run after the short-onboarding status migration. These records are never
-- company-facing: do not use swipe_actions for either purpose.

create table if not exists public.youth_saved_jobs (
  id uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (youth_user_id, job_id)
);
alter table public.youth_saved_jobs enable row level security;
drop policy if exists "youth saved jobs own only" on public.youth_saved_jobs;
create policy "youth saved jobs own only" on public.youth_saved_jobs for all
  using (auth.uid() = youth_user_id and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth') and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true))
  with check (auth.uid() = youth_user_id and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth') and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true));

create table if not exists public.youth_application_drafts (
  id uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (youth_user_id, job_id)
);
alter table public.youth_application_drafts enable row level security;
drop policy if exists "youth application drafts own only" on public.youth_application_drafts;
create policy "youth application drafts own only" on public.youth_application_drafts for all
  using (auth.uid() = youth_user_id and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth') and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true))
  with check (auth.uid() = youth_user_id and exists (select 1 from public.profiles where id = auth.uid() and role = 'youth') and exists (select 1 from public.youth_profiles where user_id = auth.uid() and short_onboarding_completed = true));

create index if not exists youth_saved_jobs_owner_created_idx on public.youth_saved_jobs (youth_user_id, created_at desc);
create index if not exists youth_application_drafts_owner_job_idx on public.youth_application_drafts (youth_user_id, job_id);
