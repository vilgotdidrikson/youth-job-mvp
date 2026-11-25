-- F26/N19: versioned application disclosure, separated from internal matching.
create table private.application_disclosures (
 job_id uuid not null references public.jobs(id) on delete cascade,
 youth_user_id uuid not null references public.profiles(id) on delete cascade,
 revision integer not null default 1 check(revision>0),
 selected_keys text[] not null default '{}',
 source_token text not null,
 packet jsonb not null,
 matching_input jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(job_id,youth_user_id)
);
create index application_disclosures_youth_idx on private.application_disclosures(youth_user_id);
alter table private.application_disclosures enable row level security;
revoke all on private.application_disclosures from public,anon,authenticated;
grant all on private.application_disclosures to service_role;

-- Strip private extraction history recursively, including nested CV arrays.
create function private.disclosed_cv_facts(p_value jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select case jsonb_typeof(p_value)
 when 'object' then (select coalesce(jsonb_object_agg(key,private.disclosed_cv_facts(value)),'{}') from jsonb_each(p_value) where key not in ('sourceNotes','evidence','textBasis','personalInfo','raw_chat','transcript','rejected_ai'))
 when 'array' then (select coalesce(jsonb_agg(private.disclosed_cv_facts(value) order by ordinality),'[]') from jsonb_array_elements(p_value) with ordinality)
 else p_value end;
$$;
revoke all on function private.disclosed_cv_facts(jsonb) from public,anon,authenticated;

create function private.build_application_disclosure(p_job uuid,p_youth uuid,p_selection text[] default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare y public.youth_profiles; j public.jobs; r jsonb; cv jsonb; docs jsonb; internal jsonb; packet jsonb; options jsonb:='[]'; item jsonb; pair record; keys text[]:=coalesce(p_selection,'{}'); body text;
begin
 select * into y from public.youth_profiles where user_id=p_youth;
 select * into j from public.jobs where id=p_job;
 if y.user_id is null or j.id is null then raise exception 'Application unavailable' using errcode='42501'; end if;
 r:=coalesce(y.recruitment_profile,'{}');
 cv:=private.disclosed_cv_facts(jsonb_build_object('profile',y.cv_structured->'profile','workExperience',y.cv_structured->'workExperience','education',y.cv_structured->'education','skills',y.cv_structured->'skills','languages',y.cv_structured->'languages','certifications',y.cv_structured->'certifications','extracurriculars',y.cv_structured->'extracurriculars','projects',y.cv_structured->'projects','otherExperience',y.cv_structured->'otherExperience'));
 -- Only the first uploaded original CV is a shared file, never other attachments.
 select coalesce(jsonb_agg(d),'[]') into docs from (select jsonb_build_object('type','cv','url',v->>'url','name',coalesce(v->>'name','CV.pdf')) d from jsonb_array_elements(coalesce(y.documents,'[]')) v where v->>'type'='cv' and v->>'url' like p_youth::text||'/%' and lower(v->>'url') like '%.pdf' and v->>'url' !~ '(^|/)\.\.?(/|$)|\\' limit 1) chosen;
 for pair in select value,ordinality-1 as idx from jsonb_array_elements(coalesce(r->'examples','[]')) with ordinality loop
  options:=options||jsonb_build_array(jsonb_build_object('key','example:'||pair.idx,'label','Eget exempel – självuppgivet','value',pair.value,'text',concat_ws(E'\n',pair.value->>'context',pair.value->>'action')));
 end loop;
 for pair in select key,value from jsonb_each(coalesce(r->'qualifications','{}')) where key in ('licences','tools','languages') loop
  for item in select value from jsonb_array_elements(pair.value) loop
   body:=case when pair.key='languages' then concat_ws(', ',item->>'language',item->>'level') else item#>>'{}' end;
   options:=options||jsonb_build_array(jsonb_build_object('key',pair.key||':'||(select count(*) from jsonb_array_elements(options) o where o->>'key' like pair.key||':%'),'value',item,'label',case pair.key when 'licences' then 'Behörighet – självuppgiven' when 'tools' then 'Kunskap – självuppgiven' else 'Språk – självuppgivet' end,'text',body));
  end loop;
 end loop;
 for pair in select match_id,company_name,role_name,start_date,show_on_profile,include_in_cv from public.employment_records where youth_user_id=p_youth and response='approved' and (show_on_profile or include_in_cv) order by start_date desc,match_id loop
  options:=options||jsonb_build_array(jsonb_build_object('key','employment:'||pair.match_id,'label','Bekräftad anställning vid delning','text',concat_ws(' · ',pair.company_name,pair.role_name,pair.start_date::text),'value',jsonb_build_object('match_id',pair.match_id,'company_name',pair.company_name,'role_name',pair.role_name,'start_date',pair.start_date,'show_on_profile',pair.show_on_profile,'include_in_cv',pair.include_in_cv)));
 end loop;
 if coalesce(r->'preferences'->>'motivation','')<>'' then options:=options||jsonb_build_array(jsonb_build_object('key','motivation','label','Egen motivation','value',r->'preferences'->'motivation','text',r->'preferences'->>'motivation')); end if;
 -- Known residential address must not leak through selected structured profile text.
 if length(coalesce(y.address,''))>=4 then
  select coalesce(jsonb_agg(case when strpos(lower(o->>'text'),lower(y.address))>0 then jsonb_set(jsonb_set(o,'{value}','null'),'{text}',to_jsonb('[Text med bostadsadress utelämnad. Rätta uppgiften i profilen.]'::text)) else o end),'[]') into options from jsonb_array_elements(options) o;
 end if;
 if cardinality(keys)>40 or exists(select 1 from unnest(keys) k where not exists(select 1 from jsonb_array_elements(options) o where o->>'key'=k)) then raise exception 'Invalid sharing selection' using errcode='22023'; end if;
 internal:=jsonb_build_object('cv_text',y.cv_text,'cv_structured',cv,'documents',docs,'recruitment_profile',r,'work_experience',y.work_experience,'education',y.education,'languages',y.languages,'employment_preferences',y.employment_preferences,'certificates',y.certificates,'extracurriculars',y.extracurriculars,
  'full_name',y.full_name,'address',y.address,'postal_code',y.postal_code,'email',to_jsonb(y)->'email','phone',to_jsonb(y)->'phone');
 packet:=jsonb_build_object('version',1,'job_id',p_job,'youth_user_id',p_youth,'job_title',j.title,'company_name',j.company_name,'identity',jsonb_build_object('full_name',y.full_name,'age',y.age),
  'cv',jsonb_build_object('text',coalesce(y.cv_text,''),'structured',cv,'documents',docs),
  'practical',jsonb_build_object('city',y.city,'availability',jsonb_build_object('days',coalesce(r->'availability'->'days','[]'),'periods',coalesce(r->'availability'->'periods','[]'),'startDate',coalesce(r->'availability'->>'startDate',''),'hours',coalesce(r->'availability'->>'hours',''))),
  'profile_items',(select coalesce(jsonb_agg(o),'[]') from jsonb_array_elements(options) o where o->>'key'=any(keys)));
 return jsonb_build_object('packet',packet,'matching_input',internal,'options',options,'source_token',md5(jsonb_build_object('input',internal,'job',jsonb_build_object('id',j.id,'title',j.title,'company',j.company_name))::text));
end $$;
revoke all on function private.build_application_disclosure(uuid,uuid,text[]) from public,anon,authenticated;

create function private.disclosure_company_access(p_job uuid,p_youth uuid,p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_company is not null and public.is_verified_company(p_company) and exists(select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id where j.id=p_job and j.company_user_id=p_company and s.youth_user_id=p_youth and s.decision='interested' and not public.users_are_blocked(p_company,p_youth));
$$;
revoke all on function private.disclosure_company_access(uuid,uuid,uuid) from public,anon,authenticated;

create function private.shared_application_packet(p_job uuid,p_youth uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select d.packet||jsonb_build_object('revision',d.revision,'shared_at',d.updated_at,
  'answers',coalesce((select a.answers from public.application_completions a where a.job_id=p_job and a.youth_user_id=p_youth and a.status='submitted'),'{}'),
  'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('question',f.question,'answer',f.answer) order by f.created_at,f.id) from public.application_followups f where f.job_id=p_job and f.youth_user_id=p_youth and f.status='answered'),'[]'))
 from private.application_disclosures d where d.job_id=p_job and d.youth_user_id=p_youth;
$$;
revoke all on function private.shared_application_packet(uuid,uuid) from public,anon,authenticated;

create function private.application_matching_input(p_job uuid,p_youth uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select d.matching_input||jsonb_build_object('job_context',(select jsonb_build_object('title',j.title,'description',j.description,'requirements',j.requirements,'employment_type',j.employment_type,'schedule',j.schedule,'workplace_cities',coalesce((select jsonb_agg(w->>'city') from jsonb_array_elements(j.workplaces) w),jsonb_build_array(j.city))) from public.jobs j where j.id=p_job),'disclosure_revision',d.revision,'source_updated_at',d.updated_at,'answers',p->'answers','followup_answers',p->'followup_answers')
 from private.application_disclosures d cross join lateral private.shared_application_packet(p_job,p_youth) p where d.job_id=p_job and d.youth_user_id=p_youth;
$$;
revoke all on function private.application_matching_input(uuid,uuid) from public,anon,authenticated;

create function public.get_application_disclosure(p_job_id uuid,p_youth_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (auth.uid()=p_youth_user_id or private.disclosure_company_access(p_job_id,p_youth_user_id,auth.uid())) then raise exception 'Application access required' using errcode='42501'; end if;
 return private.shared_application_packet(p_job_id,p_youth_user_id);
end $$;
revoke all on function public.get_application_disclosure(uuid,uuid) from public,anon;
grant execute on function public.get_application_disclosure(uuid,uuid) to authenticated;

create function public.get_my_application_disclosure_preview(p_job_id uuid,p_selection text[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.application_disclosures; current_input jsonb; j public.jobs;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth authentication required' using errcode='42501'; end if;
 select * into j from public.jobs where id=p_job_id;
 select * into existing from private.application_disclosures where job_id=p_job_id and youth_user_id=auth.uid();
 if j.id is null or public.users_are_blocked(auth.uid(),j.company_user_id) or (existing.job_id is null and (j.status<>'active' or not j.is_active or j.publication_status<>'published')) then raise exception 'Application unavailable' using errcode='42501'; end if;
 current_input:=private.build_application_disclosure(p_job_id,auth.uid(),coalesce(p_selection,'{}'));
 if p_selection is null and existing.job_id is not null then
  return jsonb_build_object('packet',private.shared_application_packet(p_job_id,auth.uid()),'matching_input',existing.matching_input-'full_name'-'address'-'postal_code'-'email'-'phone','options',current_input->'options','selected_keys',existing.selected_keys,'source_token',existing.source_token,'is_saved',true);
 end if;
 return (current_input-'matching_input')||jsonb_build_object('matching_input',(current_input->'matching_input')-'full_name'-'address'-'postal_code'-'email'-'phone','selected_keys',coalesce(p_selection,'{}'),'is_saved',false);
end $$;
revoke all on function public.get_my_application_disclosure_preview(uuid,text[]) from public,anon;
grant execute on function public.get_my_application_disclosure_preview(uuid,text[]) to authenticated;

create function public.save_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_input jsonb;
begin
 perform public.get_my_application_disclosure_preview(p_job_id,p_selection);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_job_id::text,0));
 perform 1 from public.youth_profiles where user_id=auth.uid() for share;
 current_input:=private.build_application_disclosure(p_job_id,auth.uid(),p_selection);
 if p_source_token is distinct from current_input->>'source_token' then raise exception 'Profilen har ändrats. Läs förhandsvisningen igen.' using errcode='40001'; end if;
 insert into private.application_disclosures(job_id,youth_user_id,selected_keys,source_token,packet,matching_input)
 values(p_job_id,auth.uid(),p_selection,p_source_token,current_input->'packet',current_input->'matching_input')
 on conflict(job_id,youth_user_id) do update set revision=application_disclosures.revision+1,selected_keys=excluded.selected_keys,source_token=excluded.source_token,packet=excluded.packet,matching_input=excluded.matching_input,updated_at=now();
 perform private.enqueue_application_analysis(p_job_id,auth.uid());
 return private.shared_application_packet(p_job_id,auth.uid());
end $$;
revoke all on function public.save_my_application_disclosure(uuid,text[],text) from public,anon;
grant execute on function public.save_my_application_disclosure(uuid,text[],text) to authenticated;

-- All submission paths, including drafts and old clients, receive the same default
-- CV/practical disclosure. No optional profile item is shared by default.
create function private.snapshot_application_disclosure() returns trigger language plpgsql security definer set search_path='' as $$
declare input jsonb; existing private.application_disclosures;
begin
 if new.decision<>'interested' then return new; end if;
 if tg_op='UPDATE' and old.decision='interested' then return new; end if;
 select * into existing from private.application_disclosures where job_id=new.job_id and youth_user_id=new.youth_user_id;
 input:=private.build_application_disclosure(new.job_id,new.youth_user_id,coalesce(existing.selected_keys,'{}'));
 if existing.job_id is not null then
  if existing.source_token is distinct from input->>'source_token' then raise exception 'Profilen har ändrats. Läs ansökans förhandsvisning igen.' using errcode='40001'; end if;
 else
  insert into private.application_disclosures(job_id,youth_user_id,source_token,packet,matching_input) values(new.job_id,new.youth_user_id,input->>'source_token',input->'packet',input->'matching_input');
 end if;
 return new;
end $$;
revoke all on function private.snapshot_application_disclosure() from public,anon,authenticated;
create trigger aaa_snapshot_application_disclosure before insert or update of decision on public.swipe_actions for each row execute function private.snapshot_application_disclosure();

-- Legacy interested applications already shared their CV. Cut over to a minimal
-- disclosure now, not to a fabricated historical snapshot; no extra profile items.
do $$ declare s record; input jsonb; begin
 for s in select distinct a.job_id,a.youth_user_id from public.swipe_actions a join public.youth_profiles y on y.user_id=a.youth_user_id where a.decision='interested' loop
  input:=private.build_application_disclosure(s.job_id,s.youth_user_id,'{}');
  insert into private.application_disclosures(job_id,youth_user_id,source_token,packet,matching_input) values(s.job_id,s.youth_user_id,input->>'source_token',input->'packet',input->'matching_input') on conflict do nothing;
 end loop;
end $$;

create or replace function public.get_candidate_assessment_input(p_job_id uuid,p_youth_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare packet jsonb;
begin
 if not private.disclosure_company_access(p_job_id,p_youth_user_id,auth.uid()) then raise exception 'Application access required' using errcode='42501'; end if;
 packet:=private.shared_application_packet(p_job_id,p_youth_user_id);
 return jsonb_build_object('cv_text',packet->'cv'->'text','cv_structured',packet->'cv'->'structured','documents',packet->'cv'->'documents','source_updated_at',packet->'shared_at','answers',packet->'answers','followup_answers',packet->'followup_answers','disclosure_revision',packet->'revision');
end $$;

-- Rich matching input is available only to server workers. The company identity
-- comes from verified server authentication, never from a browser role claim.
create function public.get_application_matching_input(p_job_id uuid,p_youth_user_id uuid,p_company_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.disclosure_company_access(p_job_id,p_youth_user_id,p_company_user_id) then raise exception 'Application access required' using errcode='42501'; end if;
 return private.application_matching_input(p_job_id,p_youth_user_id);
end $$;
revoke all on function public.get_application_matching_input(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_application_matching_input(uuid,uuid,uuid) to service_role;

create or replace function public.get_company_candidates(p_job_id uuid) returns table(user_id uuid,full_name text,age integer,city text,desired_roles text[],employment_preferences text[],strengths text[],work_experience text[],education text[],languages text[],cv_text text,work_experience_details jsonb,education_details jsonb)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_verified_company() or not exists(select 1 from public.jobs where id=p_job_id and company_user_id=auth.uid()) then raise exception 'Verified owner required' using errcode='42501'; end if;
 return query select d.youth_user_id,d.packet->'identity'->>'full_name',(d.packet->'identity'->>'age')::integer,d.packet->'practical'->>'city','{}'::text[],'{}'::text[],'{}'::text[],'{}'::text[],'{}'::text[],'{}'::text[],null::text,
 coalesce(d.packet->'cv'->'structured'->'workExperience','[]'),coalesce(d.packet->'cv'->'structured'->'education','[]')
 from private.application_disclosures d where d.job_id=p_job_id and private.disclosure_company_access(p_job_id,d.youth_user_id,auth.uid());
end $$;

create or replace function private.can_read_candidate_cv(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.is_verified_company() and exists(select 1 from private.application_disclosures d where private.disclosure_company_access(d.job_id,d.youth_user_id,auth.uid()) and exists(select 1 from jsonb_array_elements(d.packet->'cv'->'documents') doc where doc->>'type'='cv' and doc->>'url'=p_path));
$$;

-- Current disclosure only: old AI results may contain formerly shared profile
-- data, so retaining them internally must not retain company Data API access.
drop policy "owners read own candidate assessments" on public.candidate_assessments;
create function private.can_read_disclosed_assessment(p_job uuid,p_youth uuid,p_company uuid,p_result jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_company and (p_result->>'policyVersion')='10' and private.disclosure_company_access(p_job,p_youth,p_company) and exists(select 1 from private.application_disclosures d where d.job_id=p_job and d.youth_user_id=p_youth and d.revision::text=p_result->>'disclosureRevision');
$$;
revoke all on function private.can_read_disclosed_assessment(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function private.can_read_disclosed_assessment(uuid,uuid,uuid,jsonb) to authenticated;
create policy "owners read current disclosed assessment" on public.candidate_assessments for select to authenticated using(private.can_read_disclosed_assessment(job_id,youth_user_id,company_user_id,result));
drop policy "owners insert own candidate assessments" on public.candidate_assessments;
revoke insert on public.candidate_assessments from authenticated;

-- Explicitly shared answer changes advance the disclosure version as well.
create function private.touch_application_disclosure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='application_followups' and new.status<>'answered' and (tg_op='INSERT' or old.status<>'answered') then return new; end if;
 update private.application_disclosures set revision=revision+1,updated_at=now() where job_id=new.job_id and youth_user_id=new.youth_user_id;
 return new;
end $$;
revoke all on function private.touch_application_disclosure() from public,anon,authenticated;
create trigger zzzz_disclosure_answers after update of answers on public.application_completions for each row when(old.answers is distinct from new.answers) execute function private.touch_application_disclosure();
create trigger zzzz_disclosure_followup after insert or update of answer,status on public.application_followups for each row execute function private.touch_application_disclosure();

create or replace function public.get_application_assessment_state(p_job_id uuid,p_youth_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare task public.application_analysis_jobs; result jsonb;
begin
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
 select * into task from public.application_analysis_jobs where job_id=p_job_id and youth_user_id=p_youth_user_id;
 if task.status='completed' then select ca.result into result from public.candidate_assessments ca where ca.job_id=p_job_id and ca.youth_user_id=p_youth_user_id and ca.input_hash=task.completed_input_hash and private.can_read_disclosed_assessment(ca.job_id,ca.youth_user_id,ca.company_user_id,ca.result) order by ca.created_at desc limit 1; end if;
 return jsonb_build_object('status',case when task.status='completed' and result is null then 'unrequested' else coalesce(task.status,'unrequested') end,'assessment',result,'updated_at',task.updated_at,'retrying',task.status='failed' and task.attempts<5);
end $$;
create or replace function public.request_application_assessment(p_job_id uuid,p_youth_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
 if not private.application_analysis_eligible(p_job_id,p_youth_user_id) then return; end if;
 if not exists(select 1 from public.application_analysis_jobs t join public.candidate_assessments ca on ca.input_hash=t.completed_input_hash and ca.job_id=t.job_id and ca.youth_user_id=t.youth_user_id where t.job_id=p_job_id and t.youth_user_id=p_youth_user_id and t.status='completed' and private.can_read_disclosed_assessment(ca.job_id,ca.youth_user_id,ca.company_user_id,ca.result)) then
  if not exists(select 1 from public.application_analysis_jobs where job_id=p_job_id and youth_user_id=p_youth_user_id and status in ('pending','processing')) then perform private.enqueue_application_analysis(p_job_id,p_youth_user_id); end if;
 end if;
end $$;
-- Re-enqueue existing eligible applications to replace pre-disclosure results.
do $$ declare d record; begin for d in select job_id,youth_user_id from private.application_disclosures loop perform private.enqueue_application_analysis(d.job_id,d.youth_user_id); end loop; end $$;

-- Preserve existing queue leases and youth authorization; use frozen internal input.
CREATE OR REPLACE FUNCTION public.claim_application_analysis_jobs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare task record; results jsonb:='[]'; profile_input jsonb; match_profile public.job_match_profiles;
begin
 update public.application_analysis_jobs set status='failed',lock_token=null,error_code='worker_timeout' where status='processing' and attempts>=5 and locked_at<now()-interval '2 minutes';
 for task in select * from public.application_analysis_jobs where attempts<5 and ((status in ('pending','failed') and available_at<=now()) or (status='processing' and locked_at<now()-interval '2 minutes')) order by available_at,job_id,youth_user_id limit 2 for update skip locked loop
   if not private.application_analysis_eligible(task.job_id,task.youth_user_id) then update public.application_analysis_jobs set status='cancelled',lock_token=null,updated_at=now() where job_id=task.job_id and youth_user_id=task.youth_user_id; continue; end if;
   select * into match_profile from public.job_match_profiles where job_id=task.job_id;
   profile_input:=private.application_matching_input(task.job_id,task.youth_user_id);
   update public.application_analysis_jobs set status='processing',attempts=attempts+1,locked_at=now(),lock_token=gen_random_uuid(),error_code=null where job_id=task.job_id and youth_user_id=task.youth_user_id returning lock_token into task.lock_token;
   results:=results||jsonb_build_array(jsonb_build_object('jobId',task.job_id,'youthId',task.youth_user_id,'generation',task.generation,'lockToken',task.lock_token,'profile',profile_input,'criteria',match_profile.weighted_criteria,'version',match_profile.profile_version));
 end loop;
 return results;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_my_application_followup_input(p_job_id uuid)
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
  return result;
end; $function$;


create function public.get_application_disclosure_for_worker(p_job_id uuid,p_youth_user_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.shared_application_packet(p_job_id,p_youth_user_id) where private.application_analysis_eligible(p_job_id,p_youth_user_id);
$$;
revoke all on function public.get_application_disclosure_for_worker(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_application_disclosure_for_worker(uuid,uuid) to service_role;

grant usage on schema private to service_role;
grant execute on function private.application_matching_input(uuid,uuid) to service_role;

-- Youth see actual requirements, never weights or their individual assessment.
create function public.get_job_requirement_insight(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth authentication required' using errcode='42501'; end if;
 select jsonb_build_object('job_id',j.id,'title',j.title,'requirements',j.requirements,'role_summary',coalesce(m.role_summary,''),
  'criteria',coalesce((select jsonb_agg(jsonb_build_object('label',c->>'label','category',c->>'category','required',coalesce(c->'required'='true'::jsonb,false))) from jsonb_array_elements(m.weighted_criteria) c),'[]')) into result
 from public.jobs j left join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job_id and j.publication_status='published' and j.job_kind='employment' and not public.users_are_blocked(auth.uid(),j.company_user_id);
 if result is null then raise exception 'Job unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.get_job_requirement_insight(uuid) from public,anon;
grant execute on function public.get_job_requirement_insight(uuid) to authenticated;

-- Close the alternate generic experience RPC as well. Own/admin management stays
-- unchanged; companies receive only explicitly selected application experiences.
create or replace function private.get_verified_experience(p_youth_user_id uuid,p_job_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if caller=p_youth_user_id or public.is_admin_account() then
  return coalesce((select jsonb_agg(jsonb_build_object('match_id',match_id,'company_name',company_name,'role_name',role_name,'start_date',start_date,'show_on_profile',show_on_profile,'include_in_cv',include_in_cv) order by start_date desc) from public.employment_records where youth_user_id=p_youth_user_id and response='approved'),'[]');
 end if;
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
 return coalesce((select jsonb_agg(item->'value') from jsonb_array_elements(private.shared_application_packet(p_job_id,p_youth_user_id)->'profile_items') item where item->>'key' like 'employment:%' and exists(select 1 from public.employment_records e where e.match_id::text=item->'value'->>'match_id' and e.youth_user_id=p_youth_user_id and e.response='approved' and e.role_name=item->'value'->>'role_name' and e.start_date::text=item->'value'->>'start_date')),'[]');
end $$;
