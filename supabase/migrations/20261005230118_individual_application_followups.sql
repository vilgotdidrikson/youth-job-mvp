-- Individual, optional follow-ups supplement a submitted application.
-- Draft text stays in the youth UI; only explicitly submitted answers are shared.
create table public.application_followups (
  id uuid primary key default gen_random_uuid(),
  youth_user_id uuid not null,
  job_id uuid not null,
  criterion_key text not null,
  criterion_label text not null check(length(criterion_label) between 1 and 200),
  question text not null check(length(question) between 1 and 600),
  job_profile_version integer not null,
  status text not null default 'pending' check(status in ('pending','answered','skipped')),
  answer text not null default '' check(length(answer)<=1500),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  foreign key(youth_user_id,job_id) references public.application_completions(youth_user_id,job_id) on delete cascade,
  unique(youth_user_id,job_id,criterion_key),
  check((status='answered' and length(btrim(answer))>0) or (status in ('pending','skipped') and answer=''))
);
create index application_followups_job_idx on public.application_followups(job_id,youth_user_id);
create index application_followups_pending_idx on public.application_followups(youth_user_id,created_at) where status='pending';
alter table public.application_followups enable row level security;
revoke all on public.application_followups from public,anon,authenticated;
grant select on public.application_followups to authenticated;
grant all on public.application_followups to service_role;
alter table public.application_completions add column followup_analysis_hash text;

create schema if not exists private;
grant usage on schema private to authenticated;
-- Narrow boolean helper, with no exposure of candidate/profile data.
create function private.can_access_application_followups(p_job_id uuid,p_youth_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.jobs j join public.profiles p on p.id=auth.uid()
    where j.id=p_job_id and not public.users_are_blocked(j.company_user_id,p_youth_user_id)
    and ((p.role='youth' and p_youth_user_id=auth.uid()) or
      (p.role='company' and j.company_user_id=auth.uid() and public.is_verified_company()))
    and (exists(select 1 from public.application_completions a where a.job_id=j.id and a.youth_user_id=p_youth_user_id and a.status='submitted')
      or exists(select 1 from public.swipe_actions s where s.job_id=j.id and s.youth_user_id=p_youth_user_id and s.decision='interested'))
  );
$$;
revoke all on function private.can_access_application_followups(uuid,uuid) from public,anon;
grant execute on function private.can_access_application_followups(uuid,uuid) to authenticated;
create policy "youth read own followups" on public.application_followups for select to authenticated
using(youth_user_id=(select auth.uid()));
create policy "owners read applicant followups" on public.application_followups for select to authenticated
using(private.can_access_application_followups(job_id,youth_user_id));

create function public.get_my_application_followup_input(p_job_id uuid)
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
    'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('question',f.question,'answer',f.answer))
      from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller and f.status='answered'),'[]')),
    'weighted_criteria',m.weighted_criteria,'profile_version',m.profile_version,
    'analysis_hash',a.followup_analysis_hash,
    'available',j.status='active' and j.is_active and j.publication_status='published' and m.status='approved',
    'existing_keys',coalesce((select jsonb_agg(f.criterion_key) from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=caller),'[]'))
    into result from public.youth_profiles y join public.jobs j on j.id=p_job_id
    join public.job_match_profiles m on m.job_id=j.id
    left join public.application_completions a on a.job_id=j.id and a.youth_user_id=caller
    where y.user_id=caller;
  return result;
end; $$;
revoke all on function public.get_my_application_followup_input(uuid) from public,anon;
grant execute on function public.get_my_application_followup_input(uuid) to authenticated;

-- Question text is built from approved job criteria, never accepted from a client.
-- Limit three per pass, six over an application's lifetime, one per criterion.
create function public.queue_application_followups(p_job_id uuid,p_youth_user_id uuid,p_profile_version integer,p_labels jsonb,p_input_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); j public.jobs%rowtype; m public.job_match_profiles%rowtype;
  a public.application_completions%rowtype; label text; criterion jsonb; key text; question text;
  queued integer:=0; total integer; inserted integer; supported jsonb;
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
  if m.profile_version is distinct from p_profile_version then
    return jsonb_build_object('queued',0,'reason','criteria_changed'); end if;
  select * into a from public.application_completions where job_id=p_job_id and youth_user_id=p_youth_user_id;
  if not found then
    -- Legacy sent interests become a submitted application, never a new interest.
    insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,questions,status,submitted_at)
      values(p_youth_user_id,p_job_id,j.title,coalesce(j.company_name,''),m.profile_version,'[]','submitted',now()) returning * into a;
  end if;
  if a.status<>'submitted' then return jsonb_build_object('queued',0,'reason','not_submitted'); end if;
  select count(*) into total from public.application_followups where youth_user_id=p_youth_user_id and job_id=p_job_id;
  for criterion in select value from jsonb_array_elements(p_labels) loop
    if jsonb_typeof(criterion)<>'string' then raise exception 'Invalid criterion' using errcode='22023'; end if;
    label:=criterion#>>'{}';
    select value into supported from jsonb_array_elements(m.weighted_criteria) value
      where value->>'label'=label and coalesce(value->>'category','') not in ('trainable','trait') limit 1;
    if supported is null or label ~* '(ålder|födels|kön|etnic|relig|hälsa|diagnos|funktionsned|medborgar|nationalit|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd)' then
      raise exception 'Criterion not eligible for followup' using errcode='22023'; end if;
    if total>=6 then exit; end if;
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
  update public.application_completions set followup_analysis_hash=p_input_hash where job_id=p_job_id and youth_user_id=p_youth_user_id;
  if queued>0 then
    insert into public.notifications(user_id,type,title,body,href) values(p_youth_user_id,'application_update','Nya frågor till din ansökan',
      'Ditt matchningsunderlag för '||a.job_title||' saknar några uppgifter. Du kan komplettera din befintliga ansökan under Aktivitet.','/applications');
  end if;
  return jsonb_build_object('queued',queued,'pending',(select count(*) from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and status='pending'));
end; $$;
revoke all on function public.queue_application_followups(uuid,uuid,integer,jsonb,text) from public,anon;
grant execute on function public.queue_application_followups(uuid,uuid,integer,jsonb,text) to authenticated;

create function public.save_my_application_followup_answers(p_job_id uuid,p_answers jsonb,p_skip_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); pair record; f public.application_followups%rowtype; changed integer:=0; n integer; target uuid; employer uuid; title text;
begin
  if not exists(select 1 from public.profiles where id=caller and role='youth')
    or not private.can_access_application_followups(p_job_id,caller) then
    raise exception 'Application access required' using errcode='42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>12000 or cardinality(p_skip_ids)>6 then
    raise exception 'Invalid followup answers' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  for pair in select * from jsonb_each(p_answers) loop
    if pair.key !~ '^[0-9a-f-]{36}$' or jsonb_typeof(pair.value)<>'string' or length(pair.value#>>'{}')>1500 or length(btrim(pair.value#>>'{}'))=0 then
      raise exception 'Invalid followup answer' using errcode='22023'; end if;
    select * into f from public.application_followups where id=pair.key::uuid and job_id=p_job_id and youth_user_id=caller for update;
    if not found then raise exception 'Followup not found' using errcode='42501'; end if;
    update public.application_followups set answer=btrim(pair.value#>>'{}'),status='answered',answered_at=now()
      where id=f.id and (status<>'answered' or answer<>btrim(pair.value#>>'{}'));
    get diagnostics n=row_count; changed:=changed+n;
  end loop;
  foreach target in array coalesce(p_skip_ids,'{}') loop
    if p_answers ? target::text then raise exception 'Conflicting followup action' using errcode='22023'; end if;
    if not exists(select 1 from public.application_followups where id=target and job_id=p_job_id and youth_user_id=caller) then
      raise exception 'Followup not found' using errcode='42501'; end if;
    update public.application_followups set status='skipped',answer='',answered_at=now() where id=target and status='pending';
    get diagnostics n=row_count; changed:=changed+n;
  end loop;
  select company_user_id,jobs.title into employer,title from public.jobs where id=p_job_id;
  if changed>0 then
    -- Reassessment hashes include published answers, so old snapshots remain historical.
    update public.application_completions set followup_analysis_hash=null where job_id=p_job_id and youth_user_id=caller;
    insert into public.notifications(user_id,type,title,body,href) values(employer,'application_update','Ansökan kompletterad',
      'En kandidat har uppdaterat underlaget för '||title||'. Öppna kandidaten och uppdatera matchningsbedömningen.','/company?view=kandidater');
  end if;
  return jsonb_build_object('updated',changed,'pending',(select count(*) from public.application_followups where job_id=p_job_id and youth_user_id=caller and status='pending'));
end; $$;
revoke all on function public.save_my_application_followup_answers(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.save_my_application_followup_answers(uuid,jsonb,uuid[]) to authenticated;

-- Preserve the existing employer authorization boundary; add only submitted follow-up answers.
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
   'documents',y.documents,'answers',coalesce(a.answers,'{}'),
   'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('question',f.question,'answer',f.answer))
     from public.application_followups f where f.job_id=p_job_id and f.youth_user_id=p_youth_user_id and f.status='answered'),'[]'))
   from public.youth_profiles y left join public.application_completions a on a.job_id=p_job_id and a.youth_user_id=y.user_id and a.status='submitted'
   where y.user_id=p_youth_user_id);
end; $$;
revoke all on function public.get_candidate_assessment_input(uuid,uuid) from public,anon;
grant execute on function public.get_candidate_assessment_input(uuid,uuid) to authenticated;
