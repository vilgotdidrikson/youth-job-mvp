-- N19/N02: permanent version/status conflicts are HTTP 409, not transaction
-- serialization failures that PostgREST may retry. All guards and grants remain.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

CREATE OR REPLACE FUNCTION public.save_my_recruitment_profile(p_section text, p_value jsonb, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare row_value public.youth_profiles; next_profile jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth access required' using errcode='42501'; end if;
  if p_section is null or not p_section=any(array['availability','preferences','examples','qualifications']) or p_value is null then raise exception 'Invalid profile section' using errcode='22023'; end if;
  select * into row_value from public.youth_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if p_expected_version is null or row_value.recruitment_profile_version<>p_expected_version then raise exception 'Profilen har ändrats. Läs in den igen innan du sparar.' using errcode='PT409'; end if;
  next_profile:=jsonb_set(row_value.recruitment_profile,array[p_section],p_value);
  if not public.valid_recruitment_profile(next_profile) then raise exception 'Kontrollera profiluppgifterna och försök igen.' using errcode='22023'; end if;
  update public.youth_profiles set recruitment_profile=next_profile where user_id=auth.uid() returning * into row_value;
  return jsonb_build_object('profile',row_value.recruitment_profile,'version',row_value.recruitment_profile_version);
end; $function$;

CREATE OR REPLACE FUNCTION private.withdraw_application(p_job_id uuid, p_expected_submitted boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=auth.uid(); a public.application_completions%rowtype;
  j public.jobs%rowtype; m public.matches%rowtype; was_sent boolean; stamp timestamptz:=now();
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
    raise exception 'Ungdomsinloggning krävs.' using errcode='42501';
  end if;
  if p_job_id is null or p_expected_submitted is null then
    raise exception 'Ogiltig ansökan.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  select * into a from public.application_completions where youth_user_id=caller and job_id=p_job_id for update;
  select * into m from public.matches where youth_user_id=caller and job_id=p_job_id for update;
  was_sent:=coalesce(a.submitted_at is not null or a.status='submitted',false)
    or m.id is not null or exists(select 1 from public.swipe_actions where youth_user_id=caller and job_id=p_job_id and decision='interested');
  if a.status='withdrawn' then
    return jsonb_build_object('status','withdrawn','was_submitted',was_sent,'withdrawn_at',a.withdrawn_at,'match_id',m.id);
  end if;
  if a.job_id is null and m.id is null and not exists(select 1 from public.youth_application_drafts where youth_user_id=caller and job_id=p_job_id)
    and not exists(select 1 from public.swipe_actions where youth_user_id=caller and job_id=p_job_id and decision='interested') then
    raise exception 'Du har ingen ansökan eller något sparat intresse för jobbet.' using errcode='42501';
  end if;
  if was_sent is distinct from p_expected_submitted then
    raise exception 'Ansökningsstatus har ändrats. Ladda om Ansökningar och granska återkallelsen igen.' using errcode='PT409';
  end if;
  -- Withdrawal is not a way to undo a registered employment or its evidence.
  if m.status='hired' or exists(select 1 from public.employment_records where match_id=m.id) then
    raise exception 'En anställning är registrerad. Använd granskning eller begär rättelse i chatten.' using errcode='42501';
  end if;
  select * into j from public.jobs where id=p_job_id;
  if j.id is null then raise exception 'Annonsen finns inte längre.' using errcode='42501'; end if;
  if a.job_id is null then
    insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,status,withdrawn_at)
      values(caller,p_job_id,j.title,coalesce(j.company_name,''),1,'withdrawn',stamp);
  else
    update public.application_completions set status='withdrawn',withdrawn_at=stamp,followup_analysis_started_at=null
      where youth_user_id=caller and job_id=p_job_id;
  end if;
  delete from public.youth_application_drafts where youth_user_id=caller and job_id=p_job_id;
  -- Existing disclosure/CV/assessment policies require an interested swipe.
  -- Changing it revokes future employer reads without deleting chat history.
  insert into public.swipe_actions(youth_user_id,job_id,decision) values(caller,p_job_id,'skip')
    on conflict(youth_user_id,job_id) do update set decision='skip';
  if m.id is not null then
    update public.matches set status='cancelled' where id=m.id;
  end if;
  update public.application_analysis_jobs set status='cancelled',lock_token=null,locked_at=null,updated_at=stamp
    where job_id=p_job_id and youth_user_id=caller;
  if was_sent then
    insert into public.notifications(user_id,type,title,body,href) values(j.company_user_id,'application_update','Ansökan återkallad',
      'En kandidat har återkallat sin ansökan till '||j.title||'. En eventuell match och chatt är avslutade.',
      case when m.id is not null then '/chats?match='||m.id::text else '/company?view=kandidater&job='||p_job_id::text end);
  end if;
  return jsonb_build_object('status','withdrawn','was_submitted',was_sent,'withdrawn_at',stamp,'match_id',m.id);
end $function$;
