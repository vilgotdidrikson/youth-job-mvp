-- N18: private functional discovery state, never company candidate data.
create table public.youth_job_impressions (
 youth_user_id uuid not null references public.profiles(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 first_seen_at timestamptz not null default statement_timestamp(),
 primary key(youth_user_id,job_id)
);
create table public.youth_job_dismissals (
 youth_user_id uuid not null references public.profiles(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 dismissed_at timestamptz not null default statement_timestamp(),
 primary key(youth_user_id,job_id)
);
create index youth_job_impressions_job_idx on public.youth_job_impressions(job_id);
create index youth_job_dismissals_job_idx on public.youth_job_dismissals(job_id);
alter table public.youth_job_impressions enable row level security;
alter table public.youth_job_dismissals enable row level security;
revoke all on public.youth_job_impressions,public.youth_job_dismissals from public,anon,authenticated;
grant select on public.youth_job_impressions,public.youth_job_dismissals to authenticated;
grant insert(youth_user_id,job_id) on public.youth_job_impressions,public.youth_job_dismissals to authenticated;
create policy impressions_read_own on public.youth_job_impressions for select to authenticated using(youth_user_id=(select auth.uid()));
create policy dismissals_read_own on public.youth_job_dismissals for select to authenticated using(youth_user_id=(select auth.uid()));
create policy impressions_insert_own on public.youth_job_impressions for insert to authenticated with check(
 youth_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth')
 and exists(select 1 from public.jobs j where j.id=job_id and j.status='active' and j.is_active and j.publication_status='published' and j.job_kind='employment'));
create policy dismissals_insert_own on public.youth_job_dismissals for insert to authenticated with check(
 youth_user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth')
 and exists(select 1 from public.jobs j where j.id=job_id and j.status='active' and j.is_active and j.publication_status='published' and j.job_kind='employment'));

alter table public.jobs add column first_published_at timestamptz;
update public.jobs set first_published_at=created_at where publication_status='published';
create function public.preserve_job_first_publication() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.first_published_at is not null then
  new.first_published_at:=old.first_published_at;
 elsif new.publication_status='published' and new.status='active' and new.is_active and new.job_kind='employment' then
  new.first_published_at:=statement_timestamp();
 else new.first_published_at:=null;
 end if;
 return new;
end $$;
revoke all on function public.preserve_job_first_publication() from public,anon,authenticated;
-- Runs after existing publication/verification and active-status triggers.
create trigger zzzz_jobs_first_publication before insert or update on public.jobs for each row execute function public.preserve_job_first_publication();
