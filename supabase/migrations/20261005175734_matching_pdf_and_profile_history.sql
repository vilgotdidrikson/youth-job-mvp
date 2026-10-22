create or replace function public.get_candidate_assessment_input(p_job_id uuid,p_youth_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_verified_company() or not exists(
   select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id
   where j.id=p_job_id and j.company_user_id=auth.uid() and s.youth_user_id=p_youth_user_id
   and s.decision='interested' and not public.users_are_blocked(auth.uid(),p_youth_user_id)
 ) then raise exception 'Application access required' using errcode='42501'; end if;
 return (select jsonb_build_object('cv_text',y.cv_text,'cv_structured',jsonb_build_object('profile',y.cv_structured->'profile','workExperience',y.cv_structured->'workExperience','education',y.cv_structured->'education','skills',y.cv_structured->'skills','languages',y.cv_structured->'languages','certifications',y.cv_structured->'certifications'),
   'work_experience',y.work_experience,'education',y.education,'languages',y.languages,
   'employment_preferences',y.employment_preferences,'certificates',y.certificates,'extracurriculars',y.extracurriculars,
   'documents',y.documents,'answers',coalesce(a.answers,'{}'))
   from public.youth_profiles y left join public.application_completions a on a.job_id=p_job_id and a.youth_user_id=y.user_id and a.status='submitted'
   where y.user_id=p_youth_user_id);
end; $$;
revoke all on function public.get_candidate_assessment_input(uuid,uuid) from public,anon;
grant execute on function public.get_candidate_assessment_input(uuid,uuid) to authenticated;

-- Version history is append-only and uses the same listing-owner RLS boundary.
create table public.job_match_profile_versions (
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key(job_id,profile_version)
);
alter table public.job_match_profile_versions enable row level security;
revoke all on public.job_match_profile_versions from public,anon,authenticated;
grant select on public.job_match_profile_versions to authenticated;
grant all on public.job_match_profile_versions to service_role;
create policy "owners read criterion history" on public.job_match_profile_versions
for select to authenticated using(exists(
 select 1 from public.jobs j where j.id=job_id and j.company_user_id=(select auth.uid())
));
insert into public.job_match_profile_versions(job_id,profile_version,snapshot)
select job_id,profile_version,to_jsonb(p) from public.job_match_profiles p;

create or replace function public.touch_match_profile_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'updated_at'-'profile_version') is distinct from (to_jsonb(old)-'updated_at'-'profile_version') then
   new.updated_at:=now(); new.profile_version:=old.profile_version+1;
 else
   new.updated_at:=old.updated_at; new.profile_version:=old.profile_version;
 end if;
 return new;
end; $$;

-- Trigger-only privileged writer; clients cannot insert or mutate history.
create function public.archive_job_match_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.job_match_profile_versions(job_id,profile_version,snapshot)
 values(new.job_id,new.profile_version,to_jsonb(new)) on conflict do nothing;
 return new;
end; $$;
revoke all on function public.archive_job_match_profile() from public,anon,authenticated;
create trigger archive_job_match_profile after insert or update on public.job_match_profiles
for each row execute function public.archive_job_match_profile();
