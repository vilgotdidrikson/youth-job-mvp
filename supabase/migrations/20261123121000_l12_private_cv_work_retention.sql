-- A message and the cleanup of its parent session must take the same lock.
create function private.lock_ai_session_for_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.ai_onboarding_sessions where id=new.session_id for update;
  if not found then raise foreign_key_violation using message='CV conversation expired'; end if;
  return new;
end;
$$;
revoke all on function private.lock_ai_session_for_message() from public, anon, authenticated;
create trigger l12_lock_ai_session before insert or update on public.ai_onboarding_messages
for each row execute function private.lock_ai_session_for_message();

create function private.purge_inactive_cv_work(p_batch integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz := statement_timestamp()-interval '90 days';
        sessions_removed integer := 0; drafts_cleared integer; candidate uuid;
        batch integer := greatest(1,least(coalesce(p_batch,100),500));
begin
  with expired as (
    select user_id from public.youth_cv_drafts where content is not null and updated_at <= cutoff
    order by updated_at, user_id limit batch for update skip locked
  )
  update public.youth_cv_drafts d set content=null, revision=gen_random_uuid(),updated_at=statement_timestamp()
    from expired where d.user_id=expired.user_id and d.updated_at <= cutoff;
  get diagnostics drafts_cleared=row_count;

  for candidate in
    select s.id from public.ai_onboarding_sessions s
    where s.created_at <= cutoff and (s.completed_at is null or s.completed_at <= cutoff)
      and not exists(select 1 from public.ai_onboarding_messages m where m.session_id=s.id and m.created_at>cutoff)
    order by s.created_at, s.id limit batch for update of s skip locked
  loop
    -- Recheck child rows after acquiring the parent lock.
    delete from public.ai_onboarding_sessions s where s.id=candidate
      and not exists(select 1 from public.ai_onboarding_messages m where m.session_id=s.id and m.created_at>cutoff);
    if found then sessions_removed := sessions_removed+1; end if;
  end loop;
  return jsonb_build_object('draftsCleared',drafts_cleared,'sessionsRemoved',sessions_removed);
end;
$$;
revoke all on function private.purge_inactive_cv_work(integer) from public, anon, authenticated;
grant execute on function private.purge_inactive_cv_work(integer) to service_role;

-- Install inactive so the migration itself cannot purge historical material.
do $$ declare task bigint; begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then return; end if;
  if not exists(select 1 from cron.job where jobname='mnw-private-cv-work-retention') then
    task:=cron.schedule('mnw-private-cv-work-retention','31 * * * *','select private.purge_inactive_cv_work();');
    perform cron.alter_job(task, active:=false);
  end if;
end $$;
