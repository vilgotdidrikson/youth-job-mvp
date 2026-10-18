-- L12 video slice. No application/account/text-chat retention is enabled here.
alter table public.youth_videos
 add column first_sent_at timestamptz,
 add column expires_at timestamptz,
 add column cleanup_started_at timestamptz,
 add column deleted_at timestamptz;
-- Historical message timestamps are the only available send record. New sends
-- use server statement_timestamp(), never the caller's messages.created_at.
update public.youth_videos v set first_sent_at=(select min(m.created_at)
 from public.messages m where m.video_kind='file' and m.video_id=v.id);
update public.youth_videos set expires_at=case when first_sent_at is not null
 then first_sent_at+interval '14 days' else created_at+interval '24 hours' end;
alter table public.youth_videos alter column expires_at set not null;
alter table public.youth_videos alter column storage_path drop not null,
 alter column mime_type drop not null, alter column size_bytes drop not null,
 alter column duration_seconds drop not null;
alter table public.youth_videos add constraint video_cleanup_shape check (
 (deleted_at is null and storage_path is not null and mime_type is not null
   and size_bytes is not null and duration_seconds is not null)
 or (deleted_at is not null and storage_path is null and mime_type is null
   and size_bytes is null and duration_seconds is null)
);
create index youth_videos_cleanup_due_idx on public.youth_videos(expires_at)
 where deleted_at is null and conversation_id is not null;
-- Only upload fields may be supplied by clients. All deadlines are server owned.
revoke insert on public.youth_videos from authenticated;
grant insert(id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds,revoked_at)
 on public.youth_videos to authenticated;
create function private.initialize_video_deadline() returns trigger
 language plpgsql set search_path='' as $$
begin
 new.created_at:=statement_timestamp();
 new.expires_at:=new.created_at+interval '24 hours';
 return new;
end; $$;
revoke all on function private.initialize_video_deadline() from public,anon,authenticated;
create trigger initialize_video_deadline before insert on public.youth_videos
 for each row execute function private.initialize_video_deadline();

create or replace function private.can_view_video_metadata(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.youth_videos v
  where v.id=p_id and v.conversation_id is not null and v.revoked_at is null and (
   v.owner_id=auth.uid() or (public.is_admin_account() and exists(
    select 1 from public.moderation_reports r where r.target_snapshot->>'video_id'=v.id::text
   )) or exists (
    select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
    where auth.uid() in(c.youth_user_id,c.company_user_id) and c.match_id is not null
      and not public.users_are_blocked(c.youth_user_id,c.company_user_id)
      and m.video_kind='file' and m.video_id=v.id and v.conversation_id=c.id
   )
  )
 );
$$;


revoke all on function private.can_view_video_metadata(uuid) from public,anon;
grant execute on function private.can_view_video_metadata(uuid) to authenticated;
create or replace function private.can_read_youth_video(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.can_view_video_metadata(p_id) and exists(
  select 1 from public.youth_videos v where v.id=p_id and v.deleted_at is null
   and v.cleanup_started_at is null and v.expires_at > statement_timestamp()
 );
$$;
alter policy "video read authorized" on public.youth_videos using (
 conversation_id is not null and (owner_id=(select auth.uid()) or private.can_view_video_metadata(id))
);
alter policy "private video upload registered" on storage.objects with check (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid()) and v.conversation_id is not null
   and v.revoked_at is null and v.deleted_at is null and v.cleanup_started_at is null
   and v.expires_at > statement_timestamp())
);
-- Download under the current JWT instead of creating long-lived bearer URLs.
-- A restrictive policy also protects against future permissive SELECT policies.
drop policy "private video owner cleanup read" on storage.objects;
drop policy "private video delete revoked" on storage.objects;
create policy "video downloads only" on storage.objects as restrictive for select
 to authenticated using (bucket_id <> 'youth-profile-videos' or
  (storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info'])
   and private.video_object_readable(name)));

create or replace function private.check_video_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.youth_videos;
begin
 if tg_table_name='youth_profile_videos' then
  raise exception 'Profilvideo används inte längre.' using errcode='0A000';
 end if;
 if new.video_kind is null then return new; end if;
 if new.video_kind='profile' then
  raise exception 'Profilvideo används inte längre. Skicka en separat chattvideo.' using errcode='0A000';
 end if;
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if new.sender_user_id <> auth.uid() or not exists(select 1 from public.conversations c
   join public.matches m on m.id=c.match_id
   where c.id=new.conversation_id and c.youth_user_id=auth.uid()
     and m.status in('matched','in_contact','interview','hired')
     and not public.users_are_blocked(c.youth_user_id,c.company_user_id)) then
  raise exception 'Only the youth in an active conversation may share a video' using errcode='42501';
 end if;
 select * into v from public.youth_videos
  where id=new.video_id and owner_id=auth.uid() and revoked_at is null and deleted_at is null and cleanup_started_at is null
    and expires_at > statement_timestamp() for update;
 if v.id is null or v.conversation_id is distinct from new.conversation_id then
  raise exception 'Video unavailable or wrong conversation' using errcode='42501';
 end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='youth-profile-videos' and o.name=v.storage_path
   and (o.metadata->>'size')::bigint between 1 and 31457280 and o.metadata->>'mimetype'=v.mime_type) then
  raise exception 'Upload has not completed' using errcode='23514';
 end if;
 -- The row lock serializes simultaneous shares and cleanup claims. Neither a
 -- client-supplied message time nor a second reference can extend this deadline.
 if v.first_sent_at is null then
  update public.youth_videos set first_sent_at=statement_timestamp(),
    expires_at=statement_timestamp()+interval '14 days' where id=v.id;
 end if;
 return new;
end;
$$;

-- Service-only leases. Media is removed via the Storage API, never storage SQL.
create table private.video_cleanup_jobs (
 video_id uuid primary key references public.youth_videos(id) on delete cascade,
 lock_token uuid, locked_until timestamptz, attempts integer not null default 0,
 next_attempt_at timestamptz not null default now()
);
alter table private.video_cleanup_jobs enable row level security;
revoke all on private.video_cleanup_jobs from public,anon,authenticated;
create function public.claim_video_cleanup(p_limit integer default 10)
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
    where r.target_snapshot->>'video_id'=y.id::text)
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
create function public.finish_video_cleanup(p_video_id uuid,p_lock_token uuid,p_success boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare j private.video_cleanup_jobs;
begin
 select * into j from private.video_cleanup_jobs where video_id=p_video_id
  and lock_token=p_lock_token and locked_until>statement_timestamp() for update;
 if not found then return false; end if;
 if p_success then
  -- Minimal tombstone preserves the original message and its expiry. No object
  -- path, MIME type, file size or duration survives successful object removal.
  update public.youth_videos set storage_path=null,mime_type=null,size_bytes=null,
   duration_seconds=null,deleted_at=statement_timestamp() where id=p_video_id;
  delete from private.video_cleanup_jobs where video_id=p_video_id;
 else
  update private.video_cleanup_jobs set lock_token=null,locked_until=null,
   next_attempt_at=statement_timestamp()+least(interval '6 hours',interval '1 minute'*power(2,least(j.attempts,8)))
   where video_id=p_video_id;
 end if;
 return true;
end; $$;
revoke all on function public.claim_video_cleanup(integer),public.finish_video_cleanup(uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.claim_video_cleanup(integer),public.finish_video_cleanup(uuid,uuid,boolean) to service_role;

-- Use the same internal-worker pattern as matching, with an independent token.
do $$ begin
 if not exists(select 1 from vault.secrets where name='mnw_video_cleanup_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'mnw_video_cleanup_token');
 end if;
end $$;
create table private.video_cleanup_config (
 singleton boolean primary key default true check(singleton),
 endpoint text not null default '',enabled boolean not null default false
);
alter table private.video_cleanup_config enable row level security;
revoke all on private.video_cleanup_config from public,anon,authenticated;
insert into private.video_cleanup_config(singleton) values(true);
create function public.validate_video_cleanup_token(p_token text)
returns boolean language sql stable security definer set search_path='' as $$
 select length(p_token)=64 and p_token=(select decrypted_secret from vault.decrypted_secrets
 where name='mnw_video_cleanup_token' limit 1);
$$;
revoke all on function public.validate_video_cleanup_token(text) from public,anon,authenticated;
grant execute on function public.validate_video_cleanup_token(text) to service_role;
create function private.dispatch_video_cleanup() returns void
 language plpgsql security definer set search_path='' as $$
declare endpoint text;
begin
 select c.endpoint into endpoint from private.video_cleanup_config c where singleton and enabled;
 if endpoint is null or endpoint='' then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json',
  'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets
   where name='mnw_video_cleanup_token' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=60000);
end; $$;
revoke all on function private.dispatch_video_cleanup() from public,anon,authenticated;
select cron.schedule('mnw-video-cleanup','*/5 * * * *','select private.dispatch_video_cleanup()');
