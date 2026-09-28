-- Job and recruitment lifecycle, including support for multiple hires per listing.
-- This is repeated here so the lifecycle migration can be run independently.
create or replace function public.is_company_account(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'company'
  );
$$;

alter table public.jobs
  add column if not exists status text not null default 'active',
  add column if not exists open_positions integer not null default 1;

alter table public.jobs
  drop constraint if exists jobs_status_check,
  add constraint jobs_status_check check (status in ('active', 'paused', 'closed')),
  drop constraint if exists jobs_open_positions_check,
  add constraint jobs_open_positions_check check (open_positions >= 1 and open_positions <= 100);

update public.jobs
set status = case when is_active then 'active' else 'paused' end
where status not in ('active', 'paused', 'closed') or status is null;

alter table public.matches
  drop constraint if exists matches_status_check;
alter table public.matches
  alter column status set default 'matched';
alter table public.matches
  add constraint matches_status_check check (status in ('matched', 'in_contact', 'interview', 'hired', 'rejected', 'cancelled'));

create or replace function public.sync_job_active_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.is_active := new.status = 'active';
  return new;
end;
$$;

drop trigger if exists jobs_sync_active_status on public.jobs;
create trigger jobs_sync_active_status
  before insert or update of status on public.jobs
  for each row execute function public.sync_job_active_status();

-- Only a company participant may advance a match lifecycle state for one of its own jobs.
drop policy if exists "matches company update lifecycle" on public.matches;
create policy "matches company update lifecycle"
  on public.matches for update
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  )
  with check (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  );
