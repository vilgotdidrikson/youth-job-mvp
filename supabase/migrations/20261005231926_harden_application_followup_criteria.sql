-- Align database exclusion with the API and combine equivalent read policies.
create or replace function public.queue_application_followups(p_job_id uuid,p_youth_user_id uuid,p_profile_version integer,p_labels jsonb,p_input_hash text)
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
    if supported is null or label ~* '(ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd)' then
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

drop policy "youth read own followups" on public.application_followups;
drop policy "owners read applicant followups" on public.application_followups;
create policy "participants read application followups" on public.application_followups for select to authenticated
using(youth_user_id=(select auth.uid()) or private.can_access_application_followups(job_id,youth_user_id));
