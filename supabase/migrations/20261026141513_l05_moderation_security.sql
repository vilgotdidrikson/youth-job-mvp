-- L05: moderation is scoped to accessible targets; decisions are serialized and auditable.
-- No file deletion, retention scheduler or new profile access is enabled here.
create or replace function public.users_are_blocked(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (auth.uid() is null or auth.uid() in(first_user,second_user)
         or auth.role()='service_role' or public.is_admin_account())
  and exists(select 1 from public.user_blocks b
   where (b.blocker_user_id=first_user and b.blocked_user_id=second_user)
      or (b.blocker_user_id=second_user and b.blocked_user_id=first_user));
$$;
revoke all on function public.users_are_blocked(uuid,uuid) from public,anon;
grant execute on function public.users_are_blocked(uuid,uuid) to authenticated,service_role;

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_details text := nullif(btrim(p_details), '');
  report_id uuid;
  snapshot jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_type is null or p_target_type not in ('job', 'conversation', 'message', 'user') then
    raise exception 'Invalid report target' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('scam', 'harassment', 'discrimination', 'inappropriate', 'privacy', 'other') then
    raise exception 'Invalid report reason' using errcode = '22023';
  end if;
  if char_length(coalesce(normalized_details, '')) > 2000 then
    raise exception 'Report details are too long' using errcode = '22023';
  end if;

  if p_target_id is null then raise exception 'Report target is required' using errcode='22023'; end if;
  -- Serialize duplicate submissions from the same reporter/target.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text || ':' || p_target_type || ':' || p_target_id::text,0));

  if p_target_type = 'job' then
    if not exists (
      select 1 from public.jobs job
      where job.id = p_target_id
        and (job.company_user_id = caller_id
          or (job.publication_status='published' and job.is_active and job.status='active')
          or exists(select 1 from public.application_completions a where a.job_id=job.id and a.youth_user_id=caller_id and a.status in ('submitted','withdrawn'))
          or exists(select 1 from public.conversations c where c.job_id=job.id and caller_id in(c.youth_user_id,c.company_user_id)))
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  elsif p_target_type = 'conversation' then
    if not exists (
      select 1 from public.conversations conversation
      where conversation.id = p_target_id
        and caller_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  elsif p_target_type = 'message' then
    if not exists (
      select 1
      from public.messages message
      join public.conversations conversation on conversation.id = message.conversation_id
      where message.id = p_target_id
        and caller_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  else
    if p_target_id = caller_id or not exists (
      select 1 from public.conversations conversation
      where caller_id in (conversation.youth_user_id, conversation.company_user_id)
        and p_target_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  end if;

  select report.id into report_id
  from public.moderation_reports report
  where report.reporter_user_id = caller_id
    and report.target_type = p_target_type
    and report.target_id = p_target_id
    and report.status in ('open', 'reviewing')
  limit 1;

  if report_id is not null then
    return report_id;
  end if;

  -- The snapshot holds only content the reporter could already see.
  if p_target_type = 'job' then
    select jsonb_build_object(
      'title', job.title, 'company_name', job.company_name, 'company_user_id', job.company_user_id,
      'description', job.description, 'city', job.city, 'created_at', job.created_at
    ) into snapshot
    from public.jobs job where job.id = p_target_id;
  elsif p_target_type = 'message' then
    select jsonb_build_object(
      'conversation_id', message.conversation_id, 'sender_user_id', message.sender_user_id,
      'message_text', message.message_text, 'created_at', message.created_at, 'video_id', message.video_id
    ) into snapshot
    from public.messages message where message.id = p_target_id;
  elsif p_target_type = 'conversation' then
    select jsonb_build_object(
      'youth_user_id', conversation.youth_user_id, 'company_user_id', conversation.company_user_id,
      'job_id', conversation.job_id,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'sender_user_id', recent.sender_user_id, 'message_text', recent.message_text, 'created_at', recent.created_at, 'video_id', recent.video_id
        ) order by recent.created_at)
        from (
          select message.sender_user_id, message.message_text, message.created_at, message.video_id
          from public.messages message
          where message.conversation_id = conversation.id
          order by message.created_at desc
          limit 50
        ) recent
      ), '[]'::jsonb)
    ) into snapshot
    from public.conversations conversation where conversation.id = p_target_id;
  else
    select jsonb_build_object(
      'user_id', profile.id, 'role', profile.role,
      'display_name', coalesce(nullif(youth.full_name, ''), nullif(company.company_name, ''))
    ) into snapshot
    from public.profiles profile
    left join public.youth_profiles youth on youth.user_id = profile.id
    left join public.company_profiles company on company.user_id = profile.id
    where profile.id = p_target_id;
  end if;

  insert into public.moderation_reports(
    reporter_user_id, target_type, target_id, reason, details, target_snapshot
  ) values (
    caller_id, p_target_type, p_target_id, p_reason, normalized_details, snapshot
  ) returning id into report_id;

  return report_id;
end;
$$;


-- Keep the legacy endpoint safe for already-open clients.
create or replace function public.review_moderation_report(
 p_report_id uuid,p_status text,p_resolution_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.moderation_reports; note text:=nullif(btrim(p_resolution_note),'');
begin
 if not public.is_admin_account() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status is null or p_status not in('reviewing','resolved','dismissed') or char_length(coalesce(note,''))>2000 then
  raise exception 'Invalid moderation decision' using errcode='22023'; end if;
 select * into r from public.moderation_reports where id=p_report_id for update;
 if not found then raise exception 'Report not found' using errcode='P0002'; end if;
 -- Identical retry leaves the original decision, reviewer, timestamp and notification intact.
 if r.status=p_status and r.resolution_note is not distinct from note then return; end if;
 if r.status in('resolved','dismissed') then
  raise exception 'Ärendet är redan avslutat. Läs om listan för att se beslutet.' using errcode='40001'; end if;
 update public.moderation_reports set status=p_status,
  reviewed_at=case when p_status in('resolved','dismissed') then statement_timestamp() else null end,
  reviewed_by_user_id=auth.uid(),resolution_note=note where id=r.id;
 if p_status in('resolved','dismissed') and r.reporter_user_id is not null then
  insert into public.notifications(user_id,type,title,body,href) values(r.reporter_user_id,
   'moderation_report','Din anmälan har granskats',
   case when p_status='resolved' then 'Vi har granskat din anmälan och vidtagit lämpliga åtgärder.'
        else 'Vi har granskat din anmälan och avslutat ärendet.' end,'/notifications');
 end if;
end; $$;
revoke all on function public.review_moderation_report(uuid,text,text) from public,anon;
grant execute on function public.review_moderation_report(uuid,text,text) to authenticated,service_role;

-- Optimistic status check for the new UI, with the same row lock as the legacy path.
create or replace function public.review_moderation_report_checked(
 p_report_id uuid,p_status text,p_expected_status text,p_resolution_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.moderation_reports; note text:=nullif(btrim(p_resolution_note),'');
begin
 if not public.is_admin_account() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into r from public.moderation_reports where id=p_report_id for update;
 if not found then raise exception 'Report not found' using errcode='P0002'; end if;
 if r.status=p_status and r.resolution_note is not distinct from note then return; end if;
 if p_expected_status is null or r.status is distinct from p_expected_status then
  raise exception 'Ärendet har ändrats. Läs det senaste beslutet innan du fortsätter.' using errcode='40001'; end if;
 perform public.review_moderation_report(p_report_id,p_status,p_resolution_note);
end; $$;
revoke all on function public.review_moderation_report_checked(uuid,text,text,text) from public,anon;
grant execute on function public.review_moderation_report_checked(uuid,text,text,text) to authenticated,service_role;

-- Dedicated read keeps the existing get_moderation_reports return contract unchanged.
create or replace function public.get_moderation_casework()
returns table(id uuid,reporter_user_id uuid,target_type text,target_id uuid,reason text,
 details text,status text,created_at timestamptz,target_summary text,target_snapshot jsonb,
 reviewed_at timestamptz,reviewed_by_user_id uuid,resolution_note text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin_account() then raise exception 'Admin access required' using errcode='42501'; end if;
 return query select r.id,r.reporter_user_id,r.target_type,r.target_id,r.reason,r.details,r.status,r.created_at,
  coalesce(nullif(r.target_snapshot->>'title',''),case r.target_type when 'job' then 'Jobbannons'
   when 'conversation' then 'Konversation' when 'message' then 'Meddelande' else 'Användare' end),
  r.target_snapshot,r.reviewed_at,r.reviewed_by_user_id,r.resolution_note
  from public.moderation_reports r
  order by case r.status when 'open' then 0 when 'reviewing' then 1 else 2 end,r.created_at desc,r.id;
end; $$;
revoke all on function public.get_moderation_casework() from public,anon;
grant execute on function public.get_moderation_casework() to authenticated,service_role;

create or replace function private.capture_reported_video()
returns trigger language plpgsql security definer set search_path='' as $$
declare refs jsonb;
begin
 if auth.uid() is distinct from new.reporter_user_id then return new; end if;
 -- Reporting evidence stays available to submit even after blocking the conversation.
 if new.target_type='message' then
  select jsonb_build_array(m.video_id::text) into refs
   from public.messages m join public.conversations c on c.id=m.conversation_id
   where m.id=new.target_id and m.video_kind='file' and m.video_id is not null
    and auth.uid() in(c.youth_user_id,c.company_user_id);
 elsif new.target_type='conversation' then
  select coalesce(jsonb_agg(distinct q.video_id::text),'[]') into refs from (
   select m.video_id from public.messages m join public.conversations c on c.id=m.conversation_id
   where c.id=new.target_id and auth.uid() in(c.youth_user_id,c.company_user_id)
   order by m.created_at desc,m.id desc limit 50
  ) q where q.video_id is not null;
 end if;
 if refs is not null and jsonb_array_length(refs)>0 then
  -- Serialize with cleanup claims; a claim skips assets locked by a report transaction.
  perform 1 from public.youth_videos v where refs @> jsonb_build_array(v.id::text) order by v.id for update;
  new.target_snapshot:=coalesce(new.target_snapshot,'{}')||jsonb_build_object('video_ids',refs);
  if new.target_type='message' then new.target_snapshot:=new.target_snapshot||jsonb_build_object('video_id',refs->>0); end if;
 end if;
 return new;
end; $$;
revoke all on function private.capture_reported_video() from public,anon,authenticated;

create or replace function private.report_references_video(snapshot jsonb,video uuid)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(snapshot->>'video_id'=video::text,false)
  or coalesce(snapshot->'video_ids','[]'::jsonb) @> jsonb_build_array(video::text);
$$;
revoke all on function private.report_references_video(jsonb,uuid) from public,anon;
grant execute on function private.report_references_video(jsonb,uuid) to authenticated,service_role;
create or replace function private.can_view_video_metadata(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.youth_videos v
  where v.id=p_id and v.conversation_id is not null and v.revoked_at is null and (
   v.owner_id=auth.uid() or (public.is_admin_account() and exists(
    select 1 from public.moderation_reports r where private.report_references_video(r.target_snapshot,v.id)
   )) or exists (
    select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
    where auth.uid() in(c.youth_user_id,c.company_user_id) and c.match_id is not null
      and not public.users_are_blocked(c.youth_user_id,c.company_user_id)
      and m.video_kind='file' and m.video_id=v.id and v.conversation_id=c.id
   )
  )
 );
$$;


create or replace function public.claim_video_cleanup(p_limit integer default 10)
returns table(video_id uuid,storage_path text,lock_token uuid)
language plpgsql security definer set search_path='' as $$
declare v public.youth_videos; token uuid;
begin
 for v in select y.* from public.youth_videos y
  left join private.video_cleanup_jobs j on j.video_id=y.id
  where y.conversation_id is not null and y.deleted_at is null
   and (y.expires_at<=statement_timestamp() or y.revoked_at is not null)
   and coalesce(j.next_attempt_at,'-infinity'::timestamptz)<=statement_timestamp()
   and coalesce(j.locked_until,'-infinity'::timestamptz)<=statement_timestamp()
   -- Report retention requires a separate, bounded moderation decision. No
   -- reported bytes are destroyed by this rollout. Product access still expires.
   and not exists(select 1 from public.moderation_reports r
    where private.report_references_video(r.target_snapshot,y.id))
  order by y.expires_at limit greatest(1,least(p_limit,20)) for update of y skip locked
 loop
  token:=gen_random_uuid();
  update public.youth_videos set cleanup_started_at=coalesce(cleanup_started_at,statement_timestamp()) where id=v.id;
  insert into private.video_cleanup_jobs as j(video_id,lock_token,locked_until,attempts)
   values(v.id,token,statement_timestamp()+interval '2 minutes',1)
   on conflict on constraint video_cleanup_jobs_pkey do update set lock_token=token,
    locked_until=statement_timestamp()+interval '2 minutes',attempts=j.attempts+1;
  video_id:=v.id;storage_path:=v.storage_path;lock_token:=token;return next;
 end loop;
end; $$;

revoke all on function public.submit_moderation_report(text,uuid,text,text) from public,anon;
grant execute on function public.submit_moderation_report(text,uuid,text,text) to authenticated;

-- A reporter may follow the status, but internal decision notes/reviewer IDs
-- are delivered only through the admin-authorized casework RPC.
revoke select on public.moderation_reports from authenticated;
grant select(id,reporter_user_id,target_type,target_id,reason,details,status,created_at,reviewed_at,target_snapshot)
 on public.moderation_reports to authenticated;
