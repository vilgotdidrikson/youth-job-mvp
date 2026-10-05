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
   'answers',coalesce(a.answers,'{}'))
   from public.youth_profiles y left join public.application_completions a on a.job_id=p_job_id and a.youth_user_id=y.user_id and a.status='submitted'
   where y.user_id=p_youth_user_id);
end; $$;
revoke all on function public.get_candidate_assessment_input(uuid,uuid) from public,anon;
grant execute on function public.get_candidate_assessment_input(uuid,uuid) to authenticated;
