-- DEV: direct application submission; optional answers never gate a completed CV.
-- Filename follows DEV's applied migration version; production remains deferred.
alter table public.application_completions
  add column omitted_question_ids text[] not null default '{}' check(cardinality(omitted_question_ids)<=3),
  add column supplemented_at timestamptz,
  add column question_batch_version integer;

create or replace function public.prepare_my_application(p_job_id uuid, p_notify boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid:=auth.uid();
  j public.jobs%rowtype;
  a public.application_completions%rowtype;
  questions jsonb;
  version integer;
  new_row boolean;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
    raise exception 'Youth authentication required' using errcode='42501';
  end if;
  if not exists(select 1 from public.youth_profiles y where y.user_id=caller and (
    coalesce(btrim(y.cv_text),'')<>'' or y.cv_generated or y.cv_uploaded or exists(
      select 1 from jsonb_array_elements(coalesce(y.documents,'[]')) d where d->>'type' in ('cv','generated_cv')
    ))) then raise exception 'Complete your CV first' using errcode='42501'; end if;
  -- Serialize repeated requests for this youth/job, including the first insert.
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  select * into j from public.jobs where id=p_job_id for share;
  if j.id is null or j.status<>'active' or not j.is_active or j.publication_status<>'published'
     or public.users_are_blocked(caller,j.company_user_id) then
    raise exception 'Den här annonsen tar inte emot ansökningar.' using errcode='42501';
  end if;
  select * into a from public.application_completions where youth_user_id=caller and job_id=p_job_id;
  if found then return to_jsonb(a); end if;
  select candidate_questions,profile_version into questions,version from public.job_match_profiles
    where job_id=p_job_id and status='approved';
  questions:=coalesce(questions,'[]');
  insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,questions,status,submitted_at)
    values(caller,p_job_id,j.title,coalesce(j.company_name,''),coalesce(version,1),questions,
      'submitted',
      null) returning * into a;
  new_row:=true;
  if a.status='submitted' then
    insert into public.swipe_actions(youth_user_id,job_id,decision) values(caller,p_job_id,'interested')
      on conflict(youth_user_id,job_id) do update set decision=excluded.decision;
    update public.application_completions set submitted_at=now() where youth_user_id=caller and job_id=p_job_id returning * into a;
    delete from public.youth_application_drafts where youth_user_id=caller and job_id=p_job_id;
  else
    insert into public.youth_application_drafts(youth_user_id,job_id) values(caller,p_job_id)
      on conflict(youth_user_id,job_id) do nothing;
  end if;
  if p_notify and new_row then
    insert into public.notifications(user_id,type,title,body,href) values(caller,'application_update','Ansökan skickad',
      'Din ansökan till '||j.title||' är skickad. Eventuella frågor är frivilliga.','/applications?job='||p_job_id::text);
  end if;
  return to_jsonb(a);
end; $$;
revoke all on function public.prepare_my_application(uuid,boolean) from public,anon;
grant execute on function public.prepare_my_application(uuid,boolean) to authenticated;

-- Retain historical answers but do not ask new questions after a final decision.
create or replace function public.get_my_application_followup_input(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
  if not exists(select 1 from public.profiles where id=caller and role='youth')
     or not private.can_access_application_followups(p_job_id,caller) then
    raise exception 'Application access required' using errcode='42501';
  end if;
  select jsonb_build_object('profile',jsonb_build_object(
    'cv_text',y.cv_text,'cv_structured',y.cv_structured,'work_experience',y.work_experience,
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
  return result;
end; $$;
revoke all on function public.get_my_application_followup_input(uuid) from public,anon;
grant execute on function public.get_my_application_followup_input(uuid) to authenticated;

-- Avoid a PL/pgSQL row variable shadowing a source table alias.
-- Align database exclusion with the API and combine equivalent read policies.
create or replace function public.queue_application_followups(p_job_id uuid,p_youth_user_id uuid,p_profile_version integer,p_labels jsonb,p_input_hash text,p_source_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); j public.jobs%rowtype; m public.job_match_profiles%rowtype;
  a public.application_completions%rowtype; label text; criterion jsonb; key text; question text;
  queued integer:=0; total integer; inserted integer; supported jsonb; slots integer;
begin
  if not private.can_access_application_followups(p_job_id,p_youth_user_id) then
    raise exception 'Application access required' using errcode='42501'; end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'array' or jsonb_array_length(p_labels)>3
     or p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid followup request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_youth_user_id::text||':'||p_job_id::text,0));
  select * into j from public.jobs where id=p_job_id for share;
  select * into m from public.job_match_profiles where job_id=p_job_id for share;
  if j.status<>'active' or not j.is_active or j.publication_status<>'published' or m.status is distinct from 'approved' then
    return jsonb_build_object('queued',0,'reason','unavailable'); end if;
  if not (not exists(select 1 from public.company_interest_actions decision where decision.job_id=p_job_id and decision.youth_user_id=p_youth_user_id and decision.decision='skip') and not exists(select 1 from public.matches match where match.job_id=p_job_id and match.youth_user_id=p_youth_user_id and match.status in ('hired','rejected','cancelled'))) then return jsonb_build_object('queued',0,'reason','application_closed'); end if;
  if m.profile_version is distinct from p_profile_version then
    return jsonb_build_object('queued',0,'reason','criteria_changed'); end if;
  if p_source_updated_at is not null and (select greatest(y.updated_at,completion.submitted_at,completion.supplemented_at,(select max(f.answered_at) from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=p_youth_user_id)) from public.youth_profiles y left join public.application_completions completion on completion.job_id=p_job_id and completion.youth_user_id=y.user_id where y.user_id=p_youth_user_id)>p_source_updated_at then
    return jsonb_build_object('queued',0,'reason','source_changed'); end if;
  select * into a from public.application_completions where job_id=p_job_id and youth_user_id=p_youth_user_id;
  if not found then
    -- Legacy sent interests become a submitted application, never a new interest.
    insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,questions,status,submitted_at)
      values(p_youth_user_id,p_job_id,j.title,coalesce(j.company_name,''),m.profile_version,'[]','submitted',now()) returning * into a;
  end if;
  if a.status<>'submitted' then return jsonb_build_object('queued',0,'reason','not_submitted'); end if;
  if a.question_batch_version=p_profile_version then return jsonb_build_object('queued',0,'reason','batch_complete'); end if;
  select greatest(0,3-count(*)) into slots from jsonb_array_elements(a.questions) question
    where coalesce(btrim(a.answers->>(question->>'id')),'')='' and not (question->>'id'=any(a.omitted_question_ids));
  select count(*) into total from public.application_followups where youth_user_id=p_youth_user_id and job_id=p_job_id;
  for criterion in select value from jsonb_array_elements(p_labels) loop
    if jsonb_typeof(criterion)<>'string' then raise exception 'Invalid criterion' using errcode='22023'; end if;
    label:=criterion#>>'{}';
    select value into supported from jsonb_array_elements(m.weighted_criteria) value
      where value->>'label'=label and coalesce(value->>'category','') not in ('trainable','trait') limit 1;
    if supported is null or label ~* '(ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd)' then
      raise exception 'Criterion not eligible for followup' using errcode='22023'; end if;
    if total>=6 or queued>=slots then exit; end if;
    key:=md5(lower(regexp_replace(btrim(label),'\s+',' ','g')));
    if label ~* '(helg|arbetstid|tillgäng|börja|kväll|dagtid|omgående)' then
      question:='Vilka tider kan du arbeta och när kan du börja? Annonsens önskemål: '||label||'.';
    else
      question:='Vad vill du lägga till om ”'||label||'”? Beskriv gärna dina kunskaper eller ge ett konkret exempel från jobb, skola eller fritid.';
    end if;
    insert into public.application_followups(youth_user_id,job_id,criterion_key,criterion_label,question,job_profile_version)
      values(p_youth_user_id,p_job_id,key,label,question,m.profile_version) on conflict(youth_user_id,job_id,criterion_key) do nothing;
    get diagnostics inserted=row_count;
    queued:=queued+inserted; total:=total+inserted;
  end loop;
  update public.application_completions set followup_analysis_hash=p_input_hash,question_batch_version=p_profile_version where job_id=p_job_id and youth_user_id=p_youth_user_id;
  if queued>0 or slots<3 then
    insert into public.notifications(user_id,type,title,body,href) values(p_youth_user_id,'application_update','Frivilliga frågor till din ansökan',
      'Ansökan till '||a.job_title||' är redan skickad. Du kan komplettera den under Ansökningar.','/applications?job='||p_job_id::text);
  end if;
  return jsonb_build_object('queued',queued,'pending',(select count(*) from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and status='pending'));
end; $$;

revoke all on function public.queue_application_followups(uuid,uuid,integer,jsonb,text,timestamptz) from public,anon;
grant execute on function public.queue_application_followups(uuid,uuid,integer,jsonb,text,timestamptz) to authenticated;
create or replace function public.apply_my_application_evidence(p_job_id uuid,p_answers jsonb,p_source_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a public.application_completions%rowtype; filtered jsonb:='{}'; pair record; complete boolean;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
   raise exception 'Youth authentication required' using errcode='42501'; end if;
 if p_source_hash is null or length(p_source_hash)<>64 or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>16000 then
   raise exception 'Invalid evidence' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
 select * into a from public.application_completions where youth_user_id=caller and job_id=p_job_id for update;
 if not found then raise exception 'Application not found' using errcode='42501'; end if;
 if a.status not in ('needs_completion','submitted') then return to_jsonb(a); end if;
 if a.status='submitted' and not private.can_access_application_followups(p_job_id,caller) then raise exception 'Application access required' using errcode='42501'; end if;
 for pair in select * from jsonb_each(p_answers) loop
   if jsonb_typeof(pair.value)<>'string' or length(pair.value#>>'{}')>1500 or not exists(select 1 from jsonb_array_elements(a.questions) question where question->>'id'=pair.key) then raise exception 'Invalid evidence' using errcode='22023'; end if;
   if coalesce(btrim(a.answers->>pair.key),'')='' and not(pair.key=any(a.omitted_question_ids)) then filtered:=filtered||jsonb_build_object(pair.key,pair.value); end if;
 end loop;
 select not exists(select 1 from jsonb_array_elements(a.questions) q where coalesce(btrim((a.answers||filtered)->>(q->>'id')),'')='') into complete;
 if a.status='needs_completion' then perform public.save_my_application_answers(p_job_id,filtered,complete);
 else update public.application_completions set answers=answers||filtered where youth_user_id=caller and job_id=p_job_id; end if;
 update public.application_completions set analysis_source_hash=p_source_hash where youth_user_id=caller and job_id=p_job_id returning * into a;
 return to_jsonb(a);
end; $$;
revoke all on function public.apply_my_application_evidence(uuid,jsonb,text) from public,anon;
grant execute on function public.apply_my_application_evidence(uuid,jsonb,text) to authenticated;

-- Publish static and generated answers together, or roll back both parts.
create function public.save_my_application_supplement(p_job_id uuid,p_answers jsonb,p_skip_ids text[],p_followup_answers jsonb,p_followup_skip_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a public.application_completions%rowtype; pair record; target text;
  omitted text[]; changed boolean; followups jsonb; employer uuid;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth')
     or not private.can_access_application_followups(p_job_id,caller) then
    raise exception 'Application access required' using errcode='42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>16000
     or p_skip_ids is null or cardinality(p_skip_ids)>3 then raise exception 'Invalid answers' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  select * into a from public.application_completions where job_id=p_job_id and youth_user_id=caller for update;
  if not found or a.status<>'submitted' then raise exception 'Submitted application required' using errcode='42501'; end if;
  omitted:=a.omitted_question_ids;
  for pair in select * from jsonb_each(p_answers) loop
    if jsonb_typeof(pair.value)<>'string' or length(pair.value#>>'{}')>1500 or length(btrim(pair.value#>>'{}'))=0
       or not exists(select 1 from jsonb_array_elements(a.questions) question where question->>'id'=pair.key)
       or pair.key=any(p_skip_ids) then raise exception 'Invalid answer' using errcode='22023'; end if;
    omitted:=array_remove(omitted,pair.key);
  end loop;
  foreach target in array p_skip_ids loop
    if target is null or not exists(select 1 from jsonb_array_elements(a.questions) question where question->>'id'=target) then
      raise exception 'Question not found' using errcode='42501'; end if;
    if coalesce(btrim(a.answers->>target),'')<>'' then raise exception 'Published answers cannot be omitted' using errcode='22023'; end if;
    if not(target=any(omitted)) then omitted:=array_append(omitted,target); end if;
  end loop;
  changed:=(a.answers||p_answers) is distinct from a.answers or omitted is distinct from a.omitted_question_ids;
  update public.application_completions set answers=a.answers||p_answers,omitted_question_ids=omitted,
    supplemented_at=case when changed then now() else supplemented_at end
    where job_id=p_job_id and youth_user_id=caller;
  followups:=public.save_my_application_followup_answers(p_job_id,p_followup_answers,p_followup_skip_ids);
  if changed and coalesce((followups->>'updated')::integer,0)=0 then
    select company_user_id into employer from public.jobs where id=p_job_id;
    insert into public.notifications(user_id,type,title,body,href) values(employer,'application_update','Ansökan kompletterad',
      'En kandidat har kompletterat ansökan till '||a.job_title||'.','/company?view=kandidater&job='||p_job_id::text||'&candidate='||caller::text);
  end if;
  return jsonb_build_object('updated',changed or coalesce((followups->>'updated')::integer,0)>0);
end; $$;
revoke all on function public.save_my_application_supplement(uuid,jsonb,text[],jsonb,uuid[]) from public,anon;
grant execute on function public.save_my_application_supplement(uuid,jsonb,text[],jsonb,uuid[]) to authenticated;

create function public.apply_my_application_evidence_snapshot(p_job_id uuid,p_answers jsonb,p_source_hash text,p_source_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); stamp timestamptz;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth')
     or not private.can_access_application_followups(p_job_id,caller) then raise exception 'Application access required' using errcode='42501'; end if;
  if p_source_updated_at is null then raise exception 'Source snapshot required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  perform 1 from public.youth_profiles where user_id=caller for share;
  select greatest(y.updated_at,a.submitted_at,a.supplemented_at,(select max(f.answered_at) from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller)) into stamp
    from public.youth_profiles y join public.application_completions a on a.youth_user_id=y.user_id and a.job_id=p_job_id where y.user_id=caller;
  if stamp>p_source_updated_at then return jsonb_build_object('stale',true); end if;
  return public.apply_my_application_evidence(p_job_id,p_answers,p_source_hash);
end; $$;
revoke all on function public.apply_my_application_evidence_snapshot(uuid,jsonb,text,timestamptz) from public,anon;
grant execute on function public.apply_my_application_evidence_snapshot(uuid,jsonb,text,timestamptz) to authenticated;
create or replace function public.submit_my_application_drafts()
returns table(sent_count integer,unavailable_count integer,pending_count integer)
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); d record; a jsonb; sent integer:=0; unavailable integer:=0; pending integer:=0;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
    raise exception 'Youth authentication required' using errcode='42501'; end if;
  -- CV validation applies even to an empty draft list.
  if not exists(select 1 from public.youth_profiles y where y.user_id=caller and (
    coalesce(btrim(y.cv_text),'')<>'' or y.cv_generated or y.cv_uploaded or exists(
      select 1 from jsonb_array_elements(coalesce(y.documents,'[]')) v where v->>'type' in ('cv','generated_cv')
    ))) then raise exception 'Complete your CV first' using errcode='42501'; end if;
  for d in select job_id from public.youth_application_drafts where youth_user_id=caller order by job_id loop
    if not exists(select 1 from public.jobs j where j.id=d.job_id and j.status='active' and j.is_active and j.publication_status='published'
      and not public.users_are_blocked(caller,j.company_user_id)) then
      update public.application_completions set status='unavailable' where youth_user_id=caller and job_id=d.job_id and status='needs_completion';
      delete from public.youth_application_drafts where youth_user_id=caller and job_id=d.job_id;
      unavailable:=unavailable+1;
    else
      a:=public.prepare_my_application(d.job_id,false);
      if a->>'status'='needs_completion' then a:=public.save_my_application_answers(d.job_id,'{}',true); end if;
      if a->>'status'='submitted' then sent:=sent+1; else pending:=pending+1; end if;
    end if;
  end loop;
  if sent>0 or unavailable>0 or pending>0 then
    insert into public.notifications(user_id,type,title,body,href) values(caller,'application_update',
      case when pending>0 then 'Ansökningar att komplettera' else 'Dina ansökningar är uppdaterade' end,
      format('Ditt CV är klart. %s ansökningar skickade, %s att komplettera och %s annonser som inte längre tar emot ansökningar.',sent,pending,unavailable),'/applications');
  end if;
  return query select sent,unavailable,pending;
end; $$;
revoke all on function public.submit_my_application_drafts() from public,anon;
grant execute on function public.submit_my_application_drafts() to authenticated;
