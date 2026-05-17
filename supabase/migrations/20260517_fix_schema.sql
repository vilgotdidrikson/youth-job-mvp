-- ============================================================
-- WorkSpot schema reset  (safe to re-run)
-- Drops and recreates all tables in correct dependency order.
-- WARNING: existing data will be deleted.
-- ============================================================

-- ── extensions ───────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── drop all app tables in reverse dependency order ──────────
drop table if exists public.ai_onboarding_messages    cascade;
drop table if exists public.ai_onboarding_sessions    cascade;
drop table if exists public.messages                  cascade;
drop table if exists public.conversations             cascade;
drop table if exists public.matches                   cascade;
drop table if exists public.company_interest_actions  cascade;
drop table if exists public.swipe_actions             cascade;
drop table if exists public.jobs                      cascade;
drop table if exists public.company_profiles          cascade;
drop table if exists public.youth_profiles            cascade;
drop table if exists public.youth_cv_profiles         cascade;
drop table if exists public.profiles                  cascade;

-- ── profiles ─────────────────────────────────────────────────
create table public.profiles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('youth', 'company'))
);

alter table public.profiles enable row level security;
create policy "profiles own row"
  on public.profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ── youth_profiles ───────────────────────────────────────────
create table public.youth_profiles (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  full_name              text    not null default '',
  age                    integer,
  city                   text    not null default '',
  desired_roles          text[]  not null default '{}',
  strengths              text[]  not null default '{}',
  merits                 text[]  not null default '{}',
  work_experience        text[]  not null default '{}',
  education              text[]  not null default '{}',
  languages              text[]  not null default '{}',
  desired_locations      text[]  not null default '{}',
  employment_preferences text[]  not null default '{}',
  cv_text                text    not null default '',
  cover_letter_template  text    not null default '',
  onboarding_completed   boolean not null default false,
  cv_generated           boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table public.youth_profiles enable row level security;
create policy "youth profiles own row"
  on public.youth_profiles for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── company_profiles ─────────────────────────────────────────
create table public.company_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  company_name text not null default '',
  description  text not null default '',
  city         text not null default '',
  updated_at   timestamptz not null default now()
);

alter table public.company_profiles enable row level security;
create policy "company profiles own row"
  on public.company_profiles for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── jobs ─────────────────────────────────────────────────────
create table public.jobs (
  id              uuid    primary key default gen_random_uuid(),
  company_user_id uuid    not null references auth.users(id) on delete cascade,
  company_name    text    not null default '',
  title           text    not null,
  description     text    not null default '',
  city            text    not null default '',
  salary_per_hour text    not null default '',
  employment_type text    not null default '',
  category        text    not null default '',
  requirements    text    not null default '',
  benefits        text    not null default '',
  image_url       text    not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.jobs enable row level security;
create policy "jobs read all auth"
  on public.jobs for select
  using (auth.role() = 'authenticated');

create policy "jobs company manage own"
  on public.jobs for all
  using  (auth.uid() = company_user_id)
  with check (auth.uid() = company_user_id);

-- ── swipe_actions ─────────────────────────────────────────────
create table public.swipe_actions (
  id            uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  decision      text not null check (decision in ('interested', 'skip')),
  created_at    timestamptz not null default now(),
  unique (youth_user_id, job_id)
);

alter table public.swipe_actions enable row level security;
create policy "swipe_actions youth own"
  on public.swipe_actions for all
  using  (auth.uid() = youth_user_id)
  with check (auth.uid() = youth_user_id);

-- ── company_interest_actions ──────────────────────────────────
create table public.company_interest_actions (
  id              uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references auth.users(id) on delete cascade,
  youth_user_id   uuid not null references auth.users(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  decision        text not null check (decision in ('interested', 'skip')),
  created_at      timestamptz not null default now(),
  unique (company_user_id, youth_user_id, job_id)
);

alter table public.company_interest_actions enable row level security;
create policy "company_interest_actions company own"
  on public.company_interest_actions for all
  using  (auth.uid() = company_user_id)
  with check (auth.uid() = company_user_id);

-- ── matches ───────────────────────────────────────────────────
create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  youth_user_id   uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  status          text not null default 'matched' check (status in ('matched')),
  created_at      timestamptz not null default now(),
  unique (youth_user_id, company_user_id, job_id)
);

alter table public.matches enable row level security;
create policy "matches participant read"
  on public.matches for select
  using (auth.uid() = youth_user_id or auth.uid() = company_user_id);

create policy "matches company write"
  on public.matches for insert
  with check (auth.uid() = company_user_id);

-- ── conversations ─────────────────────────────────────────────
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid unique references public.matches(id) on delete cascade,
  youth_user_id   uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table public.conversations enable row level security;
create policy "conversations participant read"
  on public.conversations for select
  using (auth.uid() = youth_user_id or auth.uid() = company_user_id);

create policy "conversations company create"
  on public.conversations for insert
  with check (auth.uid() = company_user_id);

create policy "conversations participants update"
  on public.conversations for update
  using  (auth.uid() = youth_user_id or auth.uid() = company_user_id)
  with check (auth.uid() = youth_user_id or auth.uid() = company_user_id);

-- ── messages ──────────────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id  uuid not null references auth.users(id) on delete cascade,
  message_text    text not null,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;
create policy "messages participant read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.youth_user_id = auth.uid() or c.company_user_id = auth.uid())
    )
  );

create policy "messages participant write"
  on public.messages for insert
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.youth_user_id = auth.uid() or c.company_user_id = auth.uid())
    )
  );

-- ── ai_onboarding_sessions ────────────────────────────────────
create table public.ai_onboarding_sessions (
  id            uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.ai_onboarding_sessions enable row level security;
create policy "ai_onboarding_sessions youth own"
  on public.ai_onboarding_sessions for all
  using  (auth.uid() = youth_user_id)
  with check (auth.uid() = youth_user_id);

-- ── ai_onboarding_messages ────────────────────────────────────
create table public.ai_onboarding_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.ai_onboarding_sessions(id) on delete cascade,
  sender       text not null check (sender in ('user', 'assistant')),
  message_text text not null,
  created_at   timestamptz not null default now()
);

alter table public.ai_onboarding_messages enable row level security;
create policy "ai_onboarding_messages session owner"
  on public.ai_onboarding_messages for all
  using (
    exists (
      select 1 from public.ai_onboarding_sessions s
      where s.id = session_id and s.youth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_onboarding_sessions s
      where s.id = session_id and s.youth_user_id = auth.uid()
    )
  );