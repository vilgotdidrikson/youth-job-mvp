-- N07: skip and undo change private discovery history only, never applications.
create function private.set_discovery_dismissal(p_job_id uuid,p_undo_token timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); stamp timestamptz; removed integer;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
    raise exception 'Ungdomsinloggning krävs.' using errcode='42501';
  end if;
  if p_job_id is null then raise exception 'Jobb saknas.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
  if exists(select 1 from public.swipe_actions where youth_user_id=caller and job_id=p_job_id)
    or exists(select 1 from public.application_completions where youth_user_id=caller and job_id=p_job_id)
    or exists(select 1 from public.youth_application_drafts where youth_user_id=caller and job_id=p_job_id)
    or exists(select 1 from public.matches where youth_user_id=caller and job_id=p_job_id) then
    raise exception 'Jobbet har redan ett ansökningsval. Använd Ansökningar för att granska det.' using errcode='42501';
  end if;
  if p_undo_token is not null then
    -- Exact version plus newest known dismissal: a stale tab cannot erase a
    -- later choice. Visibility is re-read by the feed, not restored from cache.
    if exists(select 1 from public.youth_job_dismissals where youth_user_id=caller and dismissed_at>p_undo_token) then
      raise exception 'Ett senare bortval finns. Ladda om flödet.' using errcode='40001';
    end if;
    delete from public.youth_job_dismissals where youth_user_id=caller and job_id=p_job_id and dismissed_at=p_undo_token;
    get diagnostics removed=row_count;
    if removed<>1 then raise exception 'Bortvalet har ändrats. Ladda om flödet.' using errcode='40001'; end if;
    return jsonb_build_object('status','restored');
  end if;
  if not exists(select 1 from public.jobs j where j.id=p_job_id and j.status='active' and j.is_active
      and j.publication_status='published' and j.job_kind='employment'
      and not public.users_are_blocked(caller,j.company_user_id)) then
    raise exception 'Annonsen är inte tillgänglig.' using errcode='42501';
  end if;
  stamp:=clock_timestamp();
  insert into public.youth_job_dismissals(youth_user_id,job_id,dismissed_at) values(caller,p_job_id,stamp)
    on conflict(youth_user_id,job_id) do update set dismissed_at=excluded.dismissed_at;
  return jsonb_build_object('status','dismissed','undo_token',stamp);
end $$;
revoke all on function private.set_discovery_dismissal(uuid,timestamptz) from public,anon;
grant execute on function private.set_discovery_dismissal(uuid,timestamptz) to authenticated;
create function public.set_my_discovery_dismissal(p_job_id uuid,p_undo_token timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.set_discovery_dismissal(p_job_id,p_undo_token);
$$;
revoke all on function public.set_my_discovery_dismissal(uuid,timestamptz) from public,anon;
grant execute on function public.set_my_discovery_dismissal(uuid,timestamptz) to authenticated;
