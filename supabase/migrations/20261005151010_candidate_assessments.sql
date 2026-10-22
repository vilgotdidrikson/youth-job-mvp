-- Immutable analysis history, accessible only to the verified owner of the application.
create table public.candidate_assessments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  job_profile_version integer not null check(job_profile_version>0),
  input_hash text not null check(length(input_hash)=64),
  result jsonb not null check(jsonb_typeof(result)='object'),
  criteria_snapshot jsonb not null check(jsonb_typeof(criteria_snapshot)='array'),
  created_at timestamptz not null default now(),
  unique(job_id,youth_user_id,job_profile_version,input_hash)
);
create index candidate_assessments_company_idx on public.candidate_assessments(company_user_id);
create index candidate_assessments_youth_idx on public.candidate_assessments(youth_user_id);
alter table public.candidate_assessments enable row level security;
revoke all on public.candidate_assessments from public,anon,authenticated;
grant select,insert on public.candidate_assessments to authenticated;
grant all on public.candidate_assessments to service_role;
create policy "owners read own candidate assessments" on public.candidate_assessments for select to authenticated
using(company_user_id=(select auth.uid()) and public.is_verified_company() and exists(
 select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id
 where j.id=candidate_assessments.job_id and j.company_user_id=(select auth.uid())
 and s.youth_user_id=candidate_assessments.youth_user_id and s.decision='interested'
 and not public.users_are_blocked((select auth.uid()),s.youth_user_id)
));
create policy "owners insert own candidate assessments" on public.candidate_assessments for insert to authenticated
with check(company_user_id=(select auth.uid()) and public.is_verified_company() and exists(
 select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id
 where j.id=candidate_assessments.job_id and j.company_user_id=(select auth.uid())
 and s.youth_user_id=candidate_assessments.youth_user_id and s.decision='interested'
 and not public.users_are_blocked((select auth.uid()),s.youth_user_id)
));

create or replace function public.get_candidate_assessment_input(p_job_id uuid,p_youth_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_verified_company() or not exists(
   select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id
   where j.id=p_job_id and j.company_user_id=auth.uid() and s.youth_user_id=p_youth_user_id
   and s.decision='interested' and not public.users_are_blocked(auth.uid(),p_youth_user_id)
 ) then raise exception 'Application access required' using errcode='42501'; end if;
 return (select jsonb_build_object('cv_text',y.cv_text,'experience',y.experience,'skills',y.skills,
   'work_experience',y.work_experience,'education',y.education,'languages',y.languages,
   'working_time',y.working_time,'certificates',y.certificates,'extracurriculars',y.extracurriculars,
   'answers',coalesce(a.answers,'{}'))
   from public.youth_profiles y left join public.application_completions a on a.job_id=p_job_id and a.youth_user_id=y.user_id and a.status='submitted'
   where y.user_id=p_youth_user_id);
end; $$;
revoke all on function public.get_candidate_assessment_input(uuid,uuid) from public,anon;
grant execute on function public.get_candidate_assessment_input(uuid,uuid) to authenticated;
