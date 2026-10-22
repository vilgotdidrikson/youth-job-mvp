-- Snapshot optional questions at application time. Youth data stays private until submission.
create table public.application_completions (
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_title text not null,
  company_name text not null,
  profile_version integer not null,
  questions jsonb not null default '[]',
  answers jsonb not null default '{}',
  status text not null check (status in ('needs_completion','submitted','unavailable')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (youth_user_id, job_id),
  check (jsonb_typeof(questions)='array' and jsonb_array_length(questions)<=3),
  check (jsonb_typeof(answers)='object')
);
create index application_completions_job_id_idx on public.application_completions(job_id);
alter table public.application_completions enable row level security;
revoke all on public.application_completions from public, anon, authenticated;
grant select on public.application_completions to authenticated;
grant all on public.application_completions to service_role;
create policy "youth read own completion" on public.application_completions
for select to authenticated using ((select auth.uid())=youth_user_id);
create policy "owners read submitted completion" on public.application_completions
for select to authenticated using (
  status='submitted' and exists (
    select 1 from public.jobs j join public.company_profiles c on c.user_id=j.company_user_id
    where j.id=job_id and j.company_user_id=(select auth.uid()) and c.verification_status='verified'
    and not public.users_are_blocked((select auth.uid()),youth_user_id)
  )
);

-- A narrow public RPC is needed to snapshot the private employer profile.
-- Its identity, role, CV, listing availability and ownership checks precede all writes.
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
      case when jsonb_array_length(questions)=0 or exists(select 1 from public.swipe_actions where youth_user_id=caller and job_id=p_job_id and decision='interested') then 'submitted' else 'needs_completion' end,
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
  if p_notify and new_row and a.status='needs_completion' then
    insert into public.notifications(user_id,type,title,body,href) values(caller,'application_update','Komplettera din ansökan',
      'Det finns några frågor för '||j.title||'. Du kan svara eller skicka med uppgift saknas.','/applications');
  end if;
  return to_jsonb(a);
end; $$;
revoke all on function public.prepare_my_application(uuid,boolean) from public,anon;
grant execute on function public.prepare_my_application(uuid,boolean) to authenticated;

create or replace function public.save_my_application_answers(p_job_id uuid,p_answers jsonb,p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a public.application_completions%rowtype; pair record; j public.jobs%rowtype;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
    raise exception 'Youth authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  select * into a from public.application_completions where youth_user_id=caller and job_id=p_job_id for update;
  if not found then raise exception 'Application not found' using errcode='42501'; end if;
  if a.status='submitted' then return to_jsonb(a); end if;
  if a.status<>'needs_completion' then raise exception 'Application unavailable' using errcode='42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>16000 then
    raise exception 'Invalid answers' using errcode='22023'; end if;
  for pair in select * from jsonb_each(p_answers) loop
    if jsonb_typeof(pair.value)<>'string' or length(pair.value#>>'{}')>1500 or not exists(
      select 1 from jsonb_array_elements(a.questions) q where q->>'id'=pair.key
    ) then raise exception 'Invalid answer' using errcode='22023'; end if;
  end loop;
  select * into j from public.jobs where id=p_job_id for share;
  if p_submit and (j.id is null or j.status<>'active' or not j.is_active or j.publication_status<>'published'
     or public.users_are_blocked(caller,j.company_user_id)) then
    raise exception 'Den här annonsen tar inte emot ansökningar just nu. Dina sparade svar är kvar.' using errcode='42501'; end if;
  update public.application_completions set answers=a.answers||p_answers,
    status=case when p_submit then 'submitted' else status end,
    submitted_at=case when p_submit then now() else submitted_at end
    where youth_user_id=caller and job_id=p_job_id returning * into a;
  if p_submit then
    insert into public.swipe_actions(youth_user_id,job_id,decision) values(caller,p_job_id,'interested')
      on conflict(youth_user_id,job_id) do update set decision=excluded.decision;
    delete from public.youth_application_drafts where youth_user_id=caller and job_id=p_job_id;
    insert into public.notifications(user_id,type,title,body,href) values(caller,'application_update','Ansökan skickad',
      'Din ansökan till '||a.job_title||' är skickad. Arbetsgivaren får se svaren.','/applications');
  end if;
  return to_jsonb(a);
end; $$;
revoke all on function public.save_my_application_answers(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_my_application_answers(uuid,jsonb,boolean) to authenticated;

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
