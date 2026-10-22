-- MVP matching foundation: a reusable employer profile, one derived profile
-- per listing, and an atomic hand-off from private pre-CV drafts to submitted
-- applications once the youth's CV is complete.

create table public.company_match_profiles (
  company_user_id uuid primary key references auth.users(id) on delete cascade,
  culture_summary text not null default '',
  company_values text[] not null default '{}'::text[],
  valued_traits text[] not null default '{}'::text[],
  work_environment text not null default '',
  onboarding_support text not null default '',
  employee_offer text not null default '',
  source_notes text not null default '',
  profile_version integer not null default 1 check (profile_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(company_values) <= 10),
  check (cardinality(valued_traits) <= 10)
);

create table public.job_match_profiles (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'ready', 'approved')),
  role_summary text not null default '',
  must_haves text[] not null default '{}'::text[],
  trainable_requirements text[] not null default '{}'::text[],
  top_traits text[] not null default '{}'::text[],
  weighted_criteria jsonb not null default '[]'::jsonb,
  candidate_questions jsonb not null default '[]'::jsonb,
  inherited_company_version integer not null default 1 check (inherited_company_version > 0),
  profile_version integer not null default 1 check (profile_version > 0),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(top_traits) <= 5),
  check (jsonb_typeof(weighted_criteria) = 'array'),
  check (jsonb_typeof(candidate_questions) = 'array'),
  check (jsonb_array_length(candidate_questions) <= 3)
);

alter table public.company_match_profiles enable row level security;
alter table public.job_match_profiles enable row level security;

create policy "companies read own match profile"
  on public.company_match_profiles for select to authenticated
  using (
    (select auth.uid()) = company_user_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'company'
    )
  );

create policy "companies insert own match profile"
  on public.company_match_profiles for insert to authenticated
  with check (
    (select auth.uid()) = company_user_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'company'
    )
  );

create policy "companies update own match profile"
  on public.company_match_profiles for update to authenticated
  using ((select auth.uid()) = company_user_id)
  with check (
    (select auth.uid()) = company_user_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'company'
    )
  );

create policy "companies delete own match profile"
  on public.company_match_profiles for delete to authenticated
  using ((select auth.uid()) = company_user_id);

create policy "companies read own job match profiles"
  on public.job_match_profiles for select to authenticated
  using (
    exists (
      select 1 from public.jobs
      where id = job_match_profiles.job_id
        and company_user_id = (select auth.uid())
    )
  );

create policy "companies insert own job match profiles"
  on public.job_match_profiles for insert to authenticated
  with check (
    exists (
      select 1 from public.jobs
      where id = job_match_profiles.job_id
        and company_user_id = (select auth.uid())
    )
  );

create policy "companies update own job match profiles"
  on public.job_match_profiles for update to authenticated
  using (
    exists (
      select 1 from public.jobs
      where id = job_match_profiles.job_id
        and company_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.jobs
      where id = job_match_profiles.job_id
        and company_user_id = (select auth.uid())
    )
  );

create policy "companies delete own job match profiles"
  on public.job_match_profiles for delete to authenticated
  using (
    exists (
      select 1 from public.jobs
      where id = job_match_profiles.job_id
        and company_user_id = (select auth.uid())
    )
  );

-- Explicit grants keep the migration compatible with Supabase's new default
-- where public-schema objects are no longer exposed automatically.
revoke all on table public.company_match_profiles from anon;
revoke all on table public.job_match_profiles from anon;
grant select, insert, update, delete on table public.company_match_profiles to authenticated;
grant select, insert, update, delete on table public.job_match_profiles to authenticated;
grant all on table public.company_match_profiles to service_role;
grant all on table public.job_match_profiles to service_role;

create or replace function public.touch_match_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new is distinct from old then
    new.profile_version := old.profile_version + 1;
  end if;
  return new;
end;
$$;

revoke all on function public.touch_match_profile_updated_at() from public, anon, authenticated;

create trigger company_match_profiles_touch_updated_at
before update on public.company_match_profiles
for each row execute function public.touch_match_profile_updated_at();

create trigger job_match_profiles_touch_updated_at
before update on public.job_match_profiles
for each row execute function public.touch_match_profile_updated_at();

create or replace function public.submit_my_application_drafts()
returns table (sent_count integer, unavailable_count integer, pending_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  draft record;
  sent integer := 0;
  unavailable integer := 0;
  pending integer := 0;
  notification_body text;
begin
  if caller_id is null then
    raise exception 'Unauthenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = caller_id and role = 'youth'
  ) then
    raise exception 'Only youth accounts can submit application drafts' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.youth_profiles youth_profile
    where youth_profile.user_id = caller_id
      and (
        coalesce(btrim(youth_profile.cv_text), '') <> ''
        or youth_profile.cv_generated = true
        or youth_profile.cv_uploaded = true
        or exists (
          select 1
          from jsonb_array_elements(coalesce(youth_profile.documents, '[]'::jsonb)) document
          where document->>'type' in ('cv', 'generated_cv')
        )
      )
  ) then
    raise exception 'Complete your CV before submitting applications' using errcode = '42501';
  end if;

  for draft in
    select application_draft.id, application_draft.job_id,
      (job.id is not null and job.status = 'active' and job.is_active = true) as is_available
    from public.youth_application_drafts application_draft
    left join public.jobs job on job.id = application_draft.job_id
    where application_draft.youth_user_id = caller_id
    order by application_draft.created_at
    for update of application_draft
  loop
    if draft.is_available then
      insert into public.swipe_actions (youth_user_id, job_id, decision)
      values (caller_id, draft.job_id, 'interested')
      on conflict (youth_user_id, job_id)
      do update set decision = excluded.decision;
      sent := sent + 1;
    else
      unavailable := unavailable + 1;
    end if;

    delete from public.youth_application_drafts
    where id = draft.id and youth_user_id = caller_id;
  end loop;

  select count(*)::integer into pending
  from public.youth_application_drafts
  where youth_user_id = caller_id;

  if sent > 0 or unavailable > 0 then
    notification_body := case
      when sent = 1 then 'Ditt CV är klart och din sparade ansökan har skickats.'
      when sent > 1 then format('Ditt CV är klart och %s sparade ansökningar har skickats.', sent)
      else 'Ditt CV är klart.'
    end;

    if unavailable = 1 then
      notification_body := notification_body || ' En annons tar inte längre emot ansökningar.';
    elsif unavailable > 1 then
      notification_body := notification_body || format(' %s annonser tar inte längre emot ansökningar.', unavailable);
    end if;

    insert into public.notifications (user_id, type, title, body, href)
    values (caller_id, 'application_update', 'Dina ansökningar är uppdaterade', notification_body, '/notifications');
  end if;

  return query select sent, unavailable, pending;
end;
$$;

revoke all on function public.submit_my_application_drafts() from public, anon;
grant execute on function public.submit_my_application_drafts() to authenticated;
