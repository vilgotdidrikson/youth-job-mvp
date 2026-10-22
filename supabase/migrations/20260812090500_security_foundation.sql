-- Phase 1 security foundation: private youth data, role-checked writes and active jobs only.
alter table public.youth_profiles
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists cv_uploaded boolean not null default false;

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

create or replace function public.is_youth_account(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'youth'
  );
$$;

-- The application must use get_company_candidates instead of selecting youth_profiles directly.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'youth_profiles'
  loop
    execute format('drop policy if exists %I on public.youth_profiles', policy_record.policyname);
  end loop;
end $$;

alter table public.youth_profiles enable row level security;
create policy "youth profiles own select" on public.youth_profiles for select using (auth.uid() = user_id);
create policy "youth profiles own insert" on public.youth_profiles for insert with check (auth.uid() = user_id and public.is_youth_account());
create policy "youth profiles own update" on public.youth_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_youth_account());
create policy "youth profiles own delete" on public.youth_profiles for delete using (auth.uid() = user_id and public.is_youth_account());

create or replace function public.get_company_candidates(p_job_id uuid)
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
  cv_text text
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
      yp.languages, yp.cv_text
    from public.youth_profiles yp
    join public.swipe_actions swipe on swipe.youth_user_id = yp.user_id
    where swipe.job_id = p_job_id and swipe.decision = 'interested';
end;
$$;
revoke all on function public.get_company_candidates(uuid) from public;
grant execute on function public.get_company_candidates(uuid) to authenticated;

-- Chat participants may see only the display name and listing title for conversations they belong to.
create or replace function public.get_my_conversation_contacts()
returns table (conversation_id uuid, other_name text, job_title text)
language sql
security definer
set search_path = public
as $$
  select conversation.id,
    case
      when conversation.company_user_id = auth.uid() then coalesce(youth.full_name, 'Kandidat')
      else coalesce(company.company_name, 'Företag')
    end,
    job.title
  from public.conversations conversation
  left join public.youth_profiles youth on youth.user_id = conversation.youth_user_id
  left join public.company_profiles company on company.user_id = conversation.company_user_id
  left join public.jobs job on job.id = conversation.job_id
  where auth.uid() in (conversation.youth_user_id, conversation.company_user_id);
$$;
revoke all on function public.get_my_conversation_contacts() from public;
grant execute on function public.get_my_conversation_contacts() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Jobs are public only while active. Owners retain access to their own paused and closed jobs.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'jobs'
  loop
    execute format('drop policy if exists %I on public.jobs', policy_record.policyname);
  end loop;
end $$;

alter table public.jobs enable row level security;
create policy "jobs active or owner select" on public.jobs for select using (is_active = true or company_user_id = auth.uid());
create policy "jobs company insert" on public.jobs for insert with check (company_user_id = auth.uid() and public.is_company_account());
create policy "jobs company update" on public.jobs for update using (company_user_id = auth.uid() and public.is_company_account()) with check (company_user_id = auth.uid() and public.is_company_account());
create policy "jobs company delete" on public.jobs for delete using (company_user_id = auth.uid() and public.is_company_account());

-- Role-check company review, match and conversation creation at the database boundary.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'company_interest_actions'
  loop
    execute format('drop policy if exists %I on public.company_interest_actions', policy_record.policyname);
  end loop;
end $$;

create policy "company reviews own jobs" on public.company_interest_actions for all
using (company_user_id = auth.uid() and public.is_company_account() and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid()))
with check (company_user_id = auth.uid() and public.is_company_account() and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid()));

-- Private youth documents: owners can access their files, matched companies can read them.
update public.youth_profiles
set documents = coalesce((
  select jsonb_agg(
    case when document->>'url' like '%/youth-documents/%'
      then jsonb_set(document, '{url}', to_jsonb(regexp_replace(document->>'url', '^.*/youth-documents/', '')))
      else document
    end
  )
  from jsonb_array_elements(documents) document
), '[]'::jsonb)
where documents is not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'youth_profiles'
      and column_name = 'profile_image_url'
  ) then
    update public.youth_profiles
    set profile_image_url = regexp_replace(profile_image_url, '^.*/youth-documents/', '')
    where profile_image_url like '%/youth-documents/%';
  end if;
end;
$$;

update storage.buckets set public = false where id = 'youth-documents';
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%youth-documents%' or coalesce(with_check, '') like '%youth-documents%')
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end $$;

create policy "youth documents owner insert" on storage.objects for insert
with check (bucket_id = 'youth-documents' and auth.uid()::text = split_part(name, '/', 1));
create policy "youth documents owner update" on storage.objects for update
using (bucket_id = 'youth-documents' and auth.uid()::text = split_part(name, '/', 1));
create policy "youth documents owner delete" on storage.objects for delete
using (bucket_id = 'youth-documents' and auth.uid()::text = split_part(name, '/', 1));
create policy "youth documents owner or matched company read" on storage.objects for select
using (
  bucket_id = 'youth-documents'
  and (
    auth.uid()::text = split_part(name, '/', 1)
    or exists (
      select 1 from public.matches
      where youth_user_id::text = split_part(name, '/', 1)
        and company_user_id = auth.uid()
    )
  )
);
