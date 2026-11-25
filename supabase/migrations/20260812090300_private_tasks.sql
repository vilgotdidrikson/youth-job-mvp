-- Private individuals can publish one-off tasks through the existing match and chat model.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('youth', 'company', 'private'));

create table if not exists public.private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  city text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.private_profiles enable row level security;
create policy "private profiles own manage" on public.private_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.jobs
  add column if not exists job_kind text not null default 'employment';
alter table public.jobs
  drop constraint if exists jobs_job_kind_check,
  add constraint jobs_job_kind_check check (job_kind in ('employment', 'private_task'));

-- Existing job, candidate, match and conversation policies use this helper for job owners.
create or replace function public.is_company_account(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role in ('company', 'private')
  );
$$;
