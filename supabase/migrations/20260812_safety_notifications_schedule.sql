-- Safety, notifications and work schedules.
alter table public.jobs add column if not exists schedule jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists moderation_status text not null default 'approved';
alter table public.jobs drop constraint if exists jobs_moderation_status_check;
alter table public.jobs add constraint jobs_moderation_status_check check (moderation_status in ('pending', 'approved', 'removed'));

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, title text not null, body text not null default '', href text,
  read_at timestamptz, created_at timestamptz not null default now()
);
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
create policy "blocks own manage" on public.user_blocks for all using (blocker_user_id = auth.uid()) with check (blocker_user_id = auth.uid());
create policy "reports own create read" on public.reports for select using (reporter_user_id = auth.uid());
create policy "reports own create" on public.reports for insert with check (reporter_user_id = auth.uid());
create policy "notifications own manage" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
