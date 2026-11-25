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
  -- Recheck the CV and listing at final submission, not only when questions were prepared.
  if p_submit then
    perform 1 from public.youth_profiles where user_id=caller for share;
    perform public.prepare_my_application(p_job_id,false);
  end if;
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

