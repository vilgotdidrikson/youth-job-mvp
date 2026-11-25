-- F20: an affirmative, account-owned choice for future submitted applications.
create table private.application_ai_preferences (
  youth_user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled_at timestamptz,
  updated_at timestamptz not null,
  notice_version integer not null check (notice_version = 1)
);
alter table private.application_ai_preferences enable row level security;
revoke all on private.application_ai_preferences from public, anon, authenticated;
grant select on private.application_ai_preferences to service_role;

create function public.my_application_ai_preference(p_enabled boolean default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid();
  changed_at timestamptz := statement_timestamp();
begin
  if not exists(select 1 from public.youth_profiles where user_id=caller) then
    raise exception 'Youth account required' using errcode='42501';
  end if;
  if p_enabled is not null then
    insert into private.application_ai_preferences(youth_user_id,enabled_at,updated_at,notice_version)
    values(caller,case when p_enabled then changed_at end,changed_at,1)
    on conflict(youth_user_id) do update set enabled_at=case when p_enabled then clock_timestamp() end,updated_at=clock_timestamp()
      where (application_ai_preferences.enabled_at is not null) is distinct from p_enabled;
  end if;
  return exists(select 1 from private.application_ai_preferences where youth_user_id=caller and enabled_at is not null);
end $$;
revoke all on function public.my_application_ai_preference(boolean) from public, anon;
grant execute on function public.my_application_ai_preference(boolean) to authenticated;

-- Use the start of the current consent period. Re-enabling never revives an
-- assessment for a previous submission. Existing accounts default to off.
create function public.application_ai_allowed(p_job uuid,p_youth uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.application_ai_preferences c
    join public.application_completions a on a.youth_user_id=c.youth_user_id
    where a.job_id=p_job and a.youth_user_id=p_youth and a.status='submitted'
      and a.submitted_at >= c.enabled_at and c.notice_version=1
  );
$$;
revoke all on function public.application_ai_allowed(uuid,uuid) from public, anon, authenticated;
grant execute on function public.application_ai_allowed(uuid,uuid) to service_role;

CREATE OR REPLACE FUNCTION private.application_analysis_eligible(p_job uuid, p_youth uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select public.application_ai_allowed(p_job,p_youth) and private.application_content_available(p_job,p_youth) and exists(select 1 from public.jobs j join public.company_profiles cp on cp.user_id=j.company_user_id
 join public.application_completions a on a.job_id=j.id and a.youth_user_id=p_youth and a.status='submitted'
 join public.swipe_actions s on s.job_id=j.id and s.youth_user_id=p_youth and s.decision='interested'
 join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job and j.status='active' and j.is_active and j.publication_status='published' and cp.verification_status='verified'
 and not public.users_are_blocked(j.company_user_id,p_youth)
 and not exists(select 1 from public.company_interest_actions d where d.job_id=j.id and d.youth_user_id=p_youth and d.decision='skip')
 and not exists(select 1 from public.matches mt where mt.job_id=j.id and mt.youth_user_id=p_youth and mt.status in ('hired','rejected','cancelled')));
$function$;

create or replace function private.can_read_disclosed_assessment(p_job uuid,p_youth uuid,p_company uuid,p_result jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select public.application_ai_allowed(p_job,p_youth) and auth.uid()=p_company and (p_result->>'policyVersion')='10' and private.disclosure_company_access(p_job,p_youth,p_company) and exists(select 1 from private.application_disclosures d where d.job_id=p_job and d.youth_user_id=p_youth and d.revision::text=p_result->>'disclosureRevision');
$$;

create or replace function public.get_application_assessment_state(p_job_id uuid,p_youth_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare task public.application_analysis_jobs; result jsonb;
begin
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
 if not public.application_ai_allowed(p_job_id,p_youth_user_id) then return jsonb_build_object('status','unavailable','assessment',null,'retrying',false); end if;
 select * into task from public.application_analysis_jobs where job_id=p_job_id and youth_user_id=p_youth_user_id;
 if task.status='completed' then select ca.result into result from public.candidate_assessments ca where ca.job_id=p_job_id and ca.youth_user_id=p_youth_user_id and ca.input_hash=task.completed_input_hash and private.can_read_disclosed_assessment(ca.job_id,ca.youth_user_id,ca.company_user_id,ca.result) order by ca.created_at desc limit 1; end if;
 return jsonb_build_object('status',case when task.status='completed' and result is null then 'unrequested' else coalesce(task.status,'unrequested') end,'assessment',result,'updated_at',task.updated_at,'retrying',task.status='failed' and task.attempts<5);
end $$;

create or replace function public.get_application_matching_input(p_job_id uuid,p_youth_user_id uuid,p_company_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.disclosure_company_access(p_job_id,p_youth_user_id,p_company_user_id) then raise exception 'Application access required' using errcode='42501'; end if;
 if not public.application_ai_allowed(p_job_id,p_youth_user_id) then return null; end if;
 return private.application_matching_input(p_job_id,p_youth_user_id);
end $$;

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
  if not public.application_ai_allowed(p_job_id,caller) then
    return jsonb_build_object('available',false);
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

notify pgrst, 'reload schema';
