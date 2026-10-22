-- Open the supplemented application directly in the employer workspace.
create or replace function public.save_my_application_followup_answers(p_job_id uuid,p_answers jsonb,p_skip_ids uuid[] default '{}')
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
      'En kandidat har uppdaterat underlaget för '||title||'. Öppna kandidaten och uppdatera matchningsbedömningen.','/company?view=kandidater&job='||p_job_id::text||'&candidate='||caller::text);
  end if;
  return jsonb_build_object('updated',changed,'pending',(select count(*) from public.application_followups where job_id=p_job_id and youth_user_id=caller and status='pending'));
end; $$;
revoke all on function public.save_my_application_followup_answers(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.save_my_application_followup_answers(uuid,jsonb,uuid[]) to authenticated;

