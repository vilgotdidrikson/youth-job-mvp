-- N02: a durable withdrawal is also a tombstone for stale clients/CV submission.
alter table public.application_completions add column withdrawn_at timestamptz;
alter table public.application_completions drop constraint application_completions_status_check;
alter table public.application_completions add constraint application_completions_status_check
  check (status in ('needs_completion','submitted','unavailable','withdrawn'));
alter table public.application_completions add constraint application_withdrawn_timestamp
  check ((status='withdrawn') = (withdrawn_at is not null));

-- Use the same youth/job transaction lock as prepare_my_application. Guard all
-- legacy write paths too, including a draft cursor fetched before withdrawal.
create function private.guard_withdrawn_application() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.youth_user_id::text||':'||new.job_id::text,0));
  if tg_table_name='application_completions' then
    if tg_op='UPDATE' and old.status='withdrawn' and new.status<>'withdrawn' then
      raise exception 'Ansökan är återkallad och skickas inte igen automatiskt.' using errcode='42501';
    end if;
    return new;
  elsif tg_table_name='swipe_actions' then
    if new.decision<>'interested' then return new; end if;
  elsif tg_table_name='matches' then
    if new.status='cancelled' then return new; end if;
  end if;
  if exists(select 1 from public.application_completions a where a.job_id=new.job_id
       and a.youth_user_id=new.youth_user_id and a.status='withdrawn') then
      raise exception 'Ansökan är återkallad och skickas inte igen automatiskt.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function private.guard_withdrawn_application() from public,anon,authenticated;
create trigger a0_n02_completion_guard before insert or update on public.application_completions
  for each row execute function private.guard_withdrawn_application();
create trigger a0_n02_draft_guard before insert or update on public.youth_application_drafts
  for each row execute function private.guard_withdrawn_application();
create trigger a0_n02_interest_guard before insert or update on public.swipe_actions
  for each row execute function private.guard_withdrawn_application();
create trigger a0_n02_match_guard before insert or update of status on public.matches
  for each row execute function private.guard_withdrawn_application();

create function private.withdraw_application(p_job_id uuid,p_expected_submitted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
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
    raise exception 'Ansökningsstatus har ändrats. Ladda om Ansökningar och granska återkallelsen igen.' using errcode='40001';
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
end $$;
revoke all on function private.withdraw_application(uuid,boolean) from public,anon,authenticated;
grant execute on function private.withdraw_application(uuid,boolean) to authenticated;
create function public.withdraw_my_application(p_job_id uuid,p_expected_submitted boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select private.withdraw_application(p_job_id,p_expected_submitted);
$$;
revoke all on function public.withdraw_my_application(uuid,boolean) from public,anon;
grant execute on function public.withdraw_my_application(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
