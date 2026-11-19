-- Optional application-only videos share the existing private bucket and cleanup worker.
alter table public.jobs add column application_video_prompt text
  check (application_video_prompt is null or length(btrim(application_video_prompt)) between 1 and 300);
alter table public.youth_videos add column application_job_id uuid,
  add constraint video_single_context check (conversation_id is null or application_job_id is null);
create unique index application_video_one_live on public.youth_videos(application_job_id, owner_id)
  where application_job_id is not null and first_sent_at is not null and revoked_at is null and deleted_at is null;
create index youth_application_video_cleanup_idx on public.youth_videos(expires_at)
  where application_job_id is not null and deleted_at is null;

-- Kept as a reference after a job is removed so its byte cleanup can still run.
create function private.application_video_eligible(p_job uuid, p_youth uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.jobs j where j.id=p_job
   and exists(select 1 from public.application_completions a
     where a.job_id=p_job and a.youth_user_id=p_youth and a.status='submitted')
   and private.disclosure_company_access(p_job,p_youth,j.company_user_id));
$$;
revoke all on function private.application_video_eligible(uuid,uuid) from public,anon,authenticated;

create function private.application_video_enabled()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cron.job where jobname='mnw-video-cleanup' and active);
$$;
revoke all on function private.application_video_enabled() from public,anon,authenticated;

create function private.can_view_application_video(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.youth_videos v
  where v.id=p_id and v.application_job_id is not null and v.revoked_at is null
   and v.deleted_at is null and v.cleanup_started_at is null and v.expires_at>statement_timestamp()
   and private.application_video_eligible(v.application_job_id,v.owner_id)
   and (v.owner_id=auth.uid() or
     (v.first_sent_at is not null and private.disclosure_company_access(v.application_job_id,v.owner_id,auth.uid()))));
$$;
revoke all on function private.can_view_application_video(uuid) from public,anon;
grant execute on function private.can_view_application_video(uuid) to authenticated;
create policy "application video participant metadata" on public.youth_videos for select to authenticated
  using (application_job_id is not null and private.can_view_application_video(id));

-- No authenticated INSERT privileges on application_job_id. Registration is through the checked RPC.
alter policy "private video upload registered" on storage.objects with check (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid())
    and (v.conversation_id is not null or (v.application_job_id is not null and v.first_sent_at is null))
    and v.revoked_at is null and v.deleted_at is null and v.cleanup_started_at is null
    and v.expires_at > statement_timestamp())
);

create function public.get_application_video(p_job_id uuid,p_youth_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); youth uuid:=coalesce(p_youth_id,actor); prompt text; video uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if actor<>youth and not private.disclosure_company_access(p_job_id,youth,actor) then return null; end if;
 if not private.application_video_eligible(p_job_id,youth) then return null; end if;
 select v.id into video from public.youth_videos v
 where v.application_job_id=p_job_id and v.owner_id=youth and v.first_sent_at is not null and private.can_view_application_video(v.id);
 if actor=youth and private.application_video_enabled() then
  select application_video_prompt into prompt from public.jobs where id=p_job_id;
 end if;
 return jsonb_build_object('prompt',prompt,'videoId',video);
end;
$$;

create function public.manage_application_video(p_job_id uuid,p_video_id uuid,
 p_action text,p_mime text default null,p_size bigint default null,p_duration numeric default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v public.youth_videos; name text; instruction text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_action='revoke' then
  update public.youth_videos set revoked_at=coalesce(revoked_at,statement_timestamp())
   where id=p_video_id and application_job_id=p_job_id and owner_id=actor;
  if found then return 'revoked'; end if;
  raise exception 'Application video unavailable' using errcode='42501';
 end if;
 -- Lock the application row to order a video send against withdrawal.
 perform 1 from public.application_completions a where a.job_id=p_job_id and a.youth_user_id=actor for update;
 if not private.application_video_enabled() or not private.application_video_eligible(p_job_id,actor) then
  raise exception 'Application video unavailable' using errcode='42501';
 end if;
 select application_video_prompt into instruction from public.jobs where id=p_job_id;
 if instruction is null then raise exception 'Application video unavailable' using errcode='42501'; end if;
 if p_action='reserve' then
  if p_mime is null or p_mime not in ('video/mp4','video/webm','video/quicktime') then
   raise exception 'Unsupported video' using errcode='22023';
  end if;
  if exists(select 1 from public.youth_videos where application_job_id=p_job_id and owner_id=actor
     and first_sent_at is not null and revoked_at is null and deleted_at is null and expires_at>statement_timestamp()) then
   raise exception 'Application already has a video' using errcode='23505';
  end if;
  name:=actor::text||'/'||p_video_id::text||case p_mime when 'video/mp4' then '.mp4' when 'video/webm' then '.webm' else '.mov' end;
  insert into public.youth_videos(id,owner_id,application_job_id,storage_path,mime_type,size_bytes,duration_seconds)
   values(p_video_id,actor,p_job_id,name,p_mime,p_size,p_duration);
  return name;
 end if;
 if p_action='send' then
  select * into v from public.youth_videos where id=p_video_id and application_job_id=p_job_id and owner_id=actor
    and revoked_at is null and deleted_at is null and cleanup_started_at is null and expires_at>statement_timestamp() for update;
  if not found then raise exception 'Application video unavailable' using errcode='42501'; end if;
  if v.first_sent_at is not null then return 'sent'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='youth-profile-videos' and o.name=v.storage_path
    and coalesce(o.metadata->>'size','')=v.size_bytes::text and o.metadata->>'mimetype'=v.mime_type) then
   raise exception 'Uploaded video missing' using errcode='22023';
  end if;
  update public.youth_videos set revoked_at=statement_timestamp() where application_job_id=p_job_id and owner_id=actor
    and first_sent_at is not null and revoked_at is null and deleted_at is null and expires_at<=statement_timestamp();
  update public.youth_videos set first_sent_at=statement_timestamp(),expires_at=statement_timestamp()+interval '14 days'
    where id=v.id;
  return 'sent';
 end if;
 raise exception 'Unknown video action' using errcode='22023';
end;
$$;
revoke all on function public.get_application_video(uuid,uuid),public.manage_application_video(uuid,uuid,text,text,bigint,numeric) from public,anon;
grant execute on function public.get_application_video(uuid,uuid),public.manage_application_video(uuid,uuid,text,text,bigint,numeric) to authenticated;

-- Preserve the worker's current moderation and retry rules.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.claim_video_cleanup(integer)'::regprocedure) into definition;
 if position('where y.conversation_id is not null and y.deleted_at is null' in definition)=0 then
  raise exception 'Unexpected video cleanup definition';
 end if;
 execute replace(definition, 'where y.conversation_id is not null and y.deleted_at is null',
  'where (y.conversation_id is not null or y.application_job_id is not null) and y.deleted_at is null');
end $$;
