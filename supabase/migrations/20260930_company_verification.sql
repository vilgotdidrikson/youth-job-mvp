-- Company verification controls publication and candidate access without
-- preventing a company from completing onboarding or preparing listings.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "admins read own membership" on public.admin_users;
create policy "admins read own membership" on public.admin_users for select
  using (user_id = auth.uid());

create or replace function public.is_admin_account(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = check_user_id);
$$;

alter table public.company_profiles
  add column if not exists organization_number text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists verification_rejection_reason text;

alter table public.company_profiles
  drop constraint if exists company_profiles_verification_status_check,
  add constraint company_profiles_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected')),
  drop constraint if exists company_profiles_organization_number_check,
  add constraint company_profiles_organization_number_check
    check (organization_number is null or organization_number ~ '^[0-9]{6}-?[0-9]{4}$');

-- Preserve access for every company that existed before verification launched.
update public.company_profiles
set verification_status = 'verified',
    verified_at = coalesce(verified_at, now()),
    verification_rejection_reason = null
where verification_status = 'pending';

create or replace function public.is_verified_company(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.company_profiles company on company.user_id = profile.id
    where profile.id = check_user_id
      and profile.role = 'company'
      and company.verification_status = 'verified'
  );
$$;

create or replace function public.protect_company_verification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin_account() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.verification_submitted_at := case when new.organization_number is not null then now() else null end;
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
    return new;
  end if;

  if new.organization_number is distinct from old.organization_number then
    new.verification_status := 'pending';
    new.verification_submitted_at := now();
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
  elsif old.verification_status = 'rejected' then
    new.verification_status := 'pending';
    new.verification_submitted_at := now();
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
  else
    new.verification_status := old.verification_status;
    new.verification_submitted_at := old.verification_submitted_at;
    new.verified_at := old.verified_at;
    new.verified_by_user_id := old.verified_by_user_id;
    new.verification_rejection_reason := old.verification_rejection_reason;
  end if;
  return new;
end;
$$;
drop trigger if exists company_profiles_protect_verification on public.company_profiles;
create trigger company_profiles_protect_verification
  before insert or update on public.company_profiles
  for each row execute function public.protect_company_verification_fields();

alter table public.jobs
  add column if not exists publication_status text not null default 'published';
alter table public.jobs
  drop constraint if exists jobs_publication_status_check,
  add constraint jobs_publication_status_check
    check (publication_status in ('pending_verification', 'published'));
update public.jobs set publication_status = 'published';

create or replace function public.set_job_publication_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.publication_status := case
      when public.is_verified_company(new.company_user_id) then 'published'
      else 'pending_verification'
    end;
  elsif new.publication_status is distinct from old.publication_status
    and not public.is_admin_account() then
    new.publication_status := old.publication_status;
  end if;
  return new;
end;
$$;
drop trigger if exists jobs_set_publication_status on public.jobs;
create trigger jobs_set_publication_status
  before insert or update on public.jobs
  for each row execute function public.set_job_publication_status();

drop policy if exists "jobs active or owner select" on public.jobs;
drop policy if exists "jobs visible active approved or owner" on public.jobs;
create policy "jobs published active or owner select" on public.jobs for select
  using (
    company_user_id = auth.uid()
    or (is_active = true and status = 'active' and publication_status = 'published')
  );

drop policy if exists "swipe_actions company read own jobs" on public.swipe_actions;
create policy "swipe_actions verified company read own jobs"
  on public.swipe_actions for select
  using (
    public.is_verified_company()
    and exists (
      select 1 from public.jobs job
      where job.id = swipe_actions.job_id and job.company_user_id = auth.uid()
    )
  );

drop policy if exists "company reviews own jobs select" on public.company_interest_actions;
drop policy if exists "company reviews own jobs insert" on public.company_interest_actions;
drop policy if exists "company reviews own jobs update" on public.company_interest_actions;
drop policy if exists "company reviews own jobs delete" on public.company_interest_actions;
create policy "verified company reviews own jobs select" on public.company_interest_actions for select
  using (company_user_id = auth.uid() and public.is_verified_company());
create policy "verified company reviews own jobs insert" on public.company_interest_actions for insert
  with check (
    company_user_id = auth.uid() and public.is_verified_company()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
    and exists (select 1 from public.swipe_actions where swipe_actions.job_id = company_interest_actions.job_id and swipe_actions.youth_user_id = company_interest_actions.youth_user_id and swipe_actions.decision = 'interested')
  );
create policy "verified company reviews own jobs update" on public.company_interest_actions for update
  using (company_user_id = auth.uid() and public.is_verified_company())
  with check (
    company_user_id = auth.uid() and public.is_verified_company()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
    and exists (select 1 from public.swipe_actions where swipe_actions.job_id = company_interest_actions.job_id and swipe_actions.youth_user_id = company_interest_actions.youth_user_id and swipe_actions.decision = 'interested')
  );
create policy "verified company reviews own jobs delete" on public.company_interest_actions for delete
  using (company_user_id = auth.uid() and public.is_verified_company());

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
    and (job.job_kind = 'employment' or job.company_user_id = auth.uid())
    and (job.company_user_id = auth.uid() or job.publication_status = 'published');
$$;
revoke all on function public.get_job_direct_detail(uuid) from public;
grant execute on function public.get_job_direct_detail(uuid) to anon, authenticated;

create or replace function public.get_company_candidates(p_job_id uuid)
returns table (
  user_id uuid, full_name text, age integer, city text, desired_roles text[],
  employment_preferences text[], strengths text[], work_experience text[],
  education text[], languages text[], cv_text text,
  work_experience_details jsonb, education_details jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_verified_company() or not exists (
    select 1 from public.jobs where id = p_job_id and company_user_id = auth.uid()
  ) then
    raise exception 'A verified company is required to view candidates' using errcode = '42501';
  end if;

  return query
    select yp.user_id, yp.full_name, yp.age, yp.city, yp.desired_roles,
      yp.employment_preferences, yp.strengths, yp.work_experience, yp.education,
      yp.languages, null::text,
      coalesce(yp.cv_structured->'workExperience', '[]'::jsonb),
      coalesce(yp.cv_structured->'education', '[]'::jsonb)
    from public.youth_profiles yp
    join public.swipe_actions swipe on swipe.youth_user_id = yp.user_id
    where swipe.job_id = p_job_id and swipe.decision = 'interested';
end;
$$;
revoke all on function public.get_company_candidates(uuid) from public;
grant execute on function public.get_company_candidates(uuid) to authenticated;

create or replace function public.review_candidate_and_match(p_job_id uuid, p_youth_user_id uuid, p_decision text)
returns table (match_id uuid, conversation_id uuid, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid := auth.uid(); created_match uuid; created_conversation uuid;
begin
  if p_decision not in ('interested', 'skip') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if not public.is_verified_company(owner_id) then raise exception 'A verified company is required to review candidates' using errcode = '42501'; end if;
  if not exists (select 1 from public.jobs where id = p_job_id and company_user_id = owner_id) then raise exception 'Not your listing' using errcode = '42501'; end if;
  if not exists (select 1 from public.swipe_actions where job_id = p_job_id and youth_user_id = p_youth_user_id and decision = 'interested') then raise exception 'Candidate has not shown interest' using errcode = '42501'; end if;

  insert into public.company_interest_actions(company_user_id, youth_user_id, job_id, decision)
  values (owner_id, p_youth_user_id, p_job_id, p_decision)
  on conflict (company_user_id, youth_user_id, job_id) do update set decision = excluded.decision;
  if p_decision <> 'interested' then return query select null::uuid, null::uuid, false; return; end if;

  insert into public.matches(youth_user_id, company_user_id, job_id, status)
  values (p_youth_user_id, owner_id, p_job_id, 'matched')
  on conflict (youth_user_id, company_user_id, job_id) do update set status = public.matches.status
  returning id into created_match;
  insert into public.conversations(match_id, youth_user_id, company_user_id, job_id)
  values (created_match, p_youth_user_id, owner_id, p_job_id)
  on conflict do nothing returning id into created_conversation;
  if created_conversation is null then
    select conversation.id into created_conversation
    from public.conversations conversation
    where conversation.match_id = created_match;
  end if;
  return query select created_match, created_conversation, true;
end;
$$;
revoke all on function public.review_candidate_and_match(uuid, uuid, text) from public;
grant execute on function public.review_candidate_and_match(uuid, uuid, text) to authenticated;

create or replace function public.get_pending_company_verifications()
returns table (
  user_id uuid, company_name text, organization_number text, administrator text,
  city text, verification_status text, verification_submitted_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_account() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    select company.user_id, company.company_name, company.organization_number,
      company.administrator, company.city, company.verification_status,
      company.verification_submitted_at, company.updated_at
    from public.company_profiles company
    where company.verification_status in ('pending', 'rejected')
    order by company.verification_submitted_at nulls last, company.updated_at;
end;
$$;
revoke all on function public.get_pending_company_verifications() from public;
grant execute on function public.get_pending_company_verifications() to authenticated;

create or replace function public.review_company_verification(p_company_user_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_account() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'Invalid verification decision' using errcode = '22023'; end if;
  if p_decision = 'rejected' and coalesce(btrim(p_reason), '') = '' then raise exception 'A rejection reason is required' using errcode = '22023'; end if;
  if p_decision = 'verified' and not exists (
    select 1 from public.company_profiles where user_id = p_company_user_id and organization_number is not null
  ) then raise exception 'Organization number is required' using errcode = '22023'; end if;

  update public.company_profiles
  set verification_status = p_decision,
      verified_at = case when p_decision = 'verified' then now() else null end,
      verified_by_user_id = case when p_decision = 'verified' then auth.uid() else null end,
      verification_rejection_reason = case when p_decision = 'rejected' then btrim(p_reason) else null end
  where user_id = p_company_user_id;
  if not found then raise exception 'Company not found' using errcode = 'P0002'; end if;

  update public.jobs
  set publication_status = case when p_decision = 'verified' then 'published' else 'pending_verification' end
  where company_user_id = p_company_user_id;

  insert into public.notifications(user_id, type, title, body, href)
  values (
    p_company_user_id,
    'company_verification',
    case when p_decision = 'verified' then 'Företaget är verifierat' else 'Verifieringen behöver kompletteras' end,
    case when p_decision = 'verified'
      then 'Era annonser är nu synliga för arbetssökande.'
      else btrim(p_reason)
    end,
    '/company'
  );
end;
$$;
revoke all on function public.review_company_verification(uuid, text, text) from public;
grant execute on function public.review_company_verification(uuid, text, text) to authenticated;

-- Explicit least-privilege grants. CREATE OR REPLACE can reset function ACLs
-- on some deployment paths, so keep this after every function definition.
alter policy "admins read own membership" on public.admin_users to authenticated;
alter policy "swipe_actions verified company read own jobs" on public.swipe_actions to authenticated;
alter policy "verified company reviews own jobs select" on public.company_interest_actions to authenticated;
alter policy "verified company reviews own jobs insert" on public.company_interest_actions to authenticated;
alter policy "verified company reviews own jobs update" on public.company_interest_actions to authenticated;
alter policy "verified company reviews own jobs delete" on public.company_interest_actions to authenticated;

revoke all on function public.is_admin_account(uuid) from public, anon, authenticated;
revoke all on function public.is_company_account(uuid) from public, anon, authenticated;
revoke all on function public.is_verified_company(uuid) from public, anon, authenticated;
revoke all on function public.is_youth_account(uuid) from public, anon, authenticated;
grant execute on function public.is_admin_account(uuid) to authenticated, service_role;
grant execute on function public.is_company_account(uuid) to authenticated, service_role;
grant execute on function public.is_verified_company(uuid) to authenticated, service_role;
grant execute on function public.is_youth_account(uuid) to authenticated, service_role;

revoke all on function public.get_company_candidates(uuid) from public, anon, authenticated;
revoke all on function public.get_pending_company_verifications() from public, anon, authenticated;
revoke all on function public.review_candidate_and_match(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.review_company_verification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_company_candidates(uuid) to authenticated, service_role;
grant execute on function public.get_pending_company_verifications() to authenticated, service_role;
grant execute on function public.review_candidate_and_match(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.review_company_verification(uuid, text, text) to authenticated, service_role;

revoke all on function public.get_job_direct_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_job_direct_detail(uuid) to anon, authenticated, service_role;
