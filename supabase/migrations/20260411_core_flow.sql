create extension if not exists pgcrypto;

create table if not exists public.youth_cv_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  age integer,
  city text not null default '',
  target_roles text[] not null default '{}',
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  working_time text[] not null default '{}',
  experience text not null default '',
  cv_text text not null default '',
  application_text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  title text not null,
  city text not null,
  job_type text not null check (job_type in ('part-time', 'summer', 'weekend', 'extra')),
  pay text not null,
  description text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.swipe_actions (
  id uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  decision text not null check (decision in ('interested', 'skip')),
  created_at timestamptz not null default now(),
  unique (youth_user_id, job_id)
);

create table if not exists public.company_interest_actions (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  decision text not null check (decision in ('interested', 'skip')),
  created_at timestamptz not null default now(),
  unique (company_user_id, youth_user_id, job_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'matched' check (status in ('matched')),
  created_at timestamptz not null default now(),
  unique (youth_user_id, company_user_id, job_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.youth_cv_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.swipe_actions enable row level security;
alter table public.company_interest_actions enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "youth cv own rows"
on public.youth_cv_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "jobs read all auth users"
on public.jobs
for select
using (auth.role() = 'authenticated');

create policy "jobs company manage own"
on public.jobs
for all
using (auth.uid() = company_user_id)
with check (auth.uid() = company_user_id);

create policy "swipes youth own"
on public.swipe_actions
for all
using (auth.uid() = youth_user_id)
with check (auth.uid() = youth_user_id);

create policy "company interest own"
on public.company_interest_actions
for all
using (auth.uid() = company_user_id)
with check (auth.uid() = company_user_id);

create policy "matches participant read"
on public.matches
for select
using (auth.uid() = youth_user_id or auth.uid() = company_user_id);

create policy "matches company write"
on public.matches
for insert
with check (auth.uid() = company_user_id);

create policy "conversations participant read"
on public.conversations
for select
using (auth.uid() = youth_user_id or auth.uid() = company_user_id);

create policy "conversations company create"
on public.conversations
for insert
with check (auth.uid() = company_user_id);

create policy "conversations participants update"
on public.conversations
for update
using (auth.uid() = youth_user_id or auth.uid() = company_user_id)
with check (auth.uid() = youth_user_id or auth.uid() = company_user_id);

create policy "messages participant read"
on public.messages
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.youth_user_id = auth.uid() or c.company_user_id = auth.uid())
  )
);

create policy "messages participant write"
on public.messages
for insert
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.youth_user_id = auth.uid() or c.company_user_id = auth.uid())
  )
);
