-- A completed hire is a server-authorized recruitment event.  It deliberately
-- lives on the existing match so conversations, messages and applications keep
-- their current history and no parallel recruitment model is introduced.
alter table public.matches
  add column if not exists hire_completed_at timestamptz,
  add column if not exists hired_by_user_id uuid references auth.users(id);

-- Existing status values predate this event metadata.  Leave them intact: a
-- timestamp can only be asserted by the authorization function below.
drop policy if exists "matches company update lifecycle" on public.matches;
drop policy if exists "matches owner update lifecycle" on public.matches;

-- Preserve the existing non-hire lifecycle support, while preventing browser
-- writes from creating, changing, or undoing a completed hire event.
create policy "matches owner update non_hire_lifecycle"
  on public.matches for update
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and status <> 'hired'
    and hire_completed_at is null
    and hired_by_user_id is null
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  )
  with check (
    company_user_id = auth.uid()
    and public.is_company_account()
    and status <> 'hired'
    and hire_completed_at is null
    and hired_by_user_id is null
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  );

create or replace function public.mark_match_hired(p_match_id uuid)
returns setof public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_match public.matches;
begin
  if auth.uid() is null or not public.is_company_account() then
    raise exception 'Only the company that owns a match can complete a hire' using errcode = '42501';
  end if;

  -- A hire requires the authenticated company to own the listing and to be a
  -- participant in an actual match with its corresponding conversation.  No
  -- user, company, job or youth identifier is accepted from the browser.
  select match_row.* into completed_match
  from public.matches match_row
  join public.jobs job on job.id = match_row.job_id
  join public.conversations conversation on conversation.match_id = match_row.id
    and conversation.job_id = match_row.job_id
    and conversation.company_user_id = match_row.company_user_id
    and conversation.youth_user_id = match_row.youth_user_id
  where match_row.id = p_match_id
    and match_row.company_user_id = auth.uid()
    and job.company_user_id = auth.uid()
    and match_row.status in ('matched', 'in_contact', 'interview')
  for update of match_row;

  if not found then
    raise exception 'Match is not eligible to be marked as hired' using errcode = '42501';
  end if;

  update public.matches
  set status = 'hired',
      hire_completed_at = now(),
      hired_by_user_id = auth.uid(),
      updated_at = now()
  where id = completed_match.id
  returning * into completed_match;

  return next completed_match;
end;
$$;

revoke all on function public.mark_match_hired(uuid) from public;
grant execute on function public.mark_match_hired(uuid) to authenticated;

-- Candidate discovery remains useful before a match, but a free-form CV can
-- contain phone numbers, email addresses and home addresses. Return the
-- structured, non-contact overview only; the authorized PDF route is the
-- post-match channel for the complete CV.
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
  cv_text text,
  work_experience_details jsonb,
  education_details jsonb
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
