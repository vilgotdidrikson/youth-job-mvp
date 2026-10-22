-- Youth receive published listing content, not the internal assessment rubric.
-- Empty legacy fields keep already-open clients safe during deployment.
create or replace function private.get_job_requirement_insight(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then
  raise exception 'Youth authentication required' using errcode='42501';
 end if;
 select jsonb_build_object('job_id',j.id,'title',j.title,'description',j.description,'requirements',j.requirements,
   'role_summary','','criteria','[]'::jsonb) into result
 from public.jobs j
 where j.id=p_job_id and j.publication_status='published' and j.job_kind='employment'
   and not public.users_are_blocked(auth.uid(),j.company_user_id);
 if result is null then raise exception 'Job unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function private.get_job_requirement_insight(uuid) from public,anon;
grant execute on function private.get_job_requirement_insight(uuid) to authenticated;

-- Retain youth ownership checks, source preview and voluntary questions.
-- Analysis code obtains criteria separately on the server after this check.
CREATE OR REPLACE FUNCTION private.get_my_application_followup_input(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=auth.uid(); result jsonb;
begin
  if not exists(select 1 from public.profiles where id=caller and role='youth')
     or not private.can_access_application_followups(p_job_id,caller) then
    raise exception 'Application access required' using errcode='42501';
  end if;
  select jsonb_build_object('profile',jsonb_build_object(
    'cv_text',y.cv_text,'recruitment_profile',y.recruitment_profile,'cv_structured',y.cv_structured,'work_experience',y.work_experience,
    'education',y.education,'languages',y.languages,'employment_preferences',y.employment_preferences,
    'certificates',y.certificates,'extracurriculars',y.extracurriculars,'documents',y.documents,
    'answers',coalesce(a.answers,'{}'),
    'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('question',f.question,'answer',f.answer) order by f.created_at,f.id)
      from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller and f.status='answered'),'[]')),
    'questions',a.questions,'answers',a.answers,'omitted_question_ids',a.omitted_question_ids,'question_batch_version',a.question_batch_version,
    'weighted_criteria',m.weighted_criteria,'profile_version',m.profile_version,
    'analysis_hash',a.followup_analysis_hash,'source_updated_at',greatest(y.updated_at,a.submitted_at,a.supplemented_at,(select max(f.answered_at) from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller)),
    'available',j.status='active' and j.is_active and j.publication_status='published' and m.status='approved' and not exists(select 1 from public.company_interest_actions decision where decision.job_id=p_job_id and decision.youth_user_id=caller and decision.decision='skip') and not exists(select 1 from public.matches match where match.job_id=p_job_id and match.youth_user_id=caller and match.status in ('hired','rejected','cancelled')),
    'existing_keys',coalesce((select jsonb_agg(f.criterion_key) from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller),'[]'))
    into result from public.youth_profiles y join public.jobs j on j.id=p_job_id
    join public.job_match_profiles m on m.job_id=j.id
    left join public.application_completions a on a.job_id=j.id and a.youth_user_id=caller
    where y.user_id=caller;
  result:=jsonb_set(result,'{profile}',coalesce(private.application_matching_input(p_job_id,caller),'{}'));
  return result-'weighted_criteria'-'existing_keys';
end; $function$;
revoke all on function private.get_my_application_followup_input(uuid) from public,anon;
grant execute on function private.get_my_application_followup_input(uuid) to authenticated;
create or replace function public.get_my_application_followup_input(p_job_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.get_my_application_followup_input(p_job_id);
$$;
revoke all on function public.get_my_application_followup_input(uuid) from public,anon;
grant execute on function public.get_my_application_followup_input(uuid) to authenticated;
