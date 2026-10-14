-- N11/N12/N13: immutable private media, explicit references and revocation.
create table public.youth_videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('video/mp4','video/webm','video/quicktime')),
  size_bytes bigint not null check (size_bytes between 1 and 31457280),
  duration_seconds numeric not null check (duration_seconds > 0 and duration_seconds <= 60),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint video_generated_path check (storage_path = owner_id::text || '/' || id::text ||
    case mime_type when 'video/mp4' then '.mp4' when 'video/webm' then '.webm' else '.mov' end)
);
create index youth_videos_owner_idx on public.youth_videos(owner_id);
create index youth_videos_conversation_idx on public.youth_videos(conversation_id);
create table public.youth_profile_videos (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  video_id uuid not null unique references public.youth_videos(id),
  updated_at timestamptz not null default now()
);
alter table public.messages add column video_kind text check (video_kind in ('profile','file'));
alter table public.messages add column video_id uuid references public.youth_videos(id);
alter table public.messages add constraint messages_video_shape check (
  case when video_kind is null then video_id is null
       when video_kind='profile' then video_id is null
       when video_kind='file' then video_id is not null else false end
);
create index messages_video_id_idx on public.messages(video_id) where video_id is not null;

-- These private lookups deliberately bypass owner-only source RLS. They return
-- booleans only, require auth.uid(), use qualified names and are not Data API RPCs.
create or replace function private.can_read_youth_video(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.youth_videos v where v.id=p_id and v.revoked_at is null and (
   v.owner_id=auth.uid() or (public.is_admin_account() and exists(
    select 1 from public.moderation_reports r where r.target_snapshot->>'video_id'=v.id::text
   )) or (
    exists(select 1 from public.youth_profile_videos pv where pv.video_id=v.id) and
    public.is_verified_company() and exists (
     select 1 from public.swipe_actions s join public.jobs j on j.id=s.job_id
     where s.youth_user_id=v.owner_id and s.decision='interested'
       and j.company_user_id=auth.uid() and not public.users_are_blocked(auth.uid(),v.owner_id)
    )
   ) or exists (
    select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
    where auth.uid() in(c.youth_user_id,c.company_user_id) and c.match_id is not null
      and not public.users_are_blocked(c.youth_user_id,c.company_user_id)
      and ((m.video_kind='file' and m.video_id=v.id and v.conversation_id=c.id)
       or (m.video_kind='profile' and m.sender_user_id=v.owner_id and exists(
          select 1 from public.youth_profile_videos pv where pv.video_id=v.id)))
   )
  )
 );
$$;
create or replace function private.video_object_readable(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.youth_videos v
  where v.storage_path=p_path and private.can_read_youth_video(v.id));
$$;
revoke all on function private.can_read_youth_video(uuid), private.video_object_readable(text) from public, anon;
grant execute on function private.can_read_youth_video(uuid), private.video_object_readable(text) to authenticated;

alter table public.youth_videos enable row level security;
alter table public.youth_profile_videos enable row level security;
revoke all on public.youth_videos, public.youth_profile_videos from anon, authenticated;
grant select, insert on public.youth_videos to authenticated;
grant update(revoked_at) on public.youth_videos to authenticated;
grant select, insert, update, delete on public.youth_profile_videos to authenticated;
create policy "video read authorized" on public.youth_videos for select to authenticated
 using(owner_id=(select auth.uid()) or private.can_read_youth_video(id));
create policy "video register own" on public.youth_videos for insert to authenticated with check (
 owner_id=(select auth.uid()) and revoked_at is null and exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth') and
 (conversation_id is null or exists(select 1 from public.conversations c join public.matches m on m.id=c.match_id
  where c.id=conversation_id and c.youth_user_id=(select auth.uid())
   and m.status in('matched','in_contact','interview','hired')
   and not public.users_are_blocked(c.youth_user_id,c.company_user_id)))
);
create policy "video revoke own" on public.youth_videos for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and revoked_at is not null);
create policy "profile video read" on public.youth_profile_videos for select to authenticated
 using(user_id=(select auth.uid()) or private.can_read_youth_video(video_id));
create policy "profile video insert own" on public.youth_profile_videos for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy "profile video update own" on public.youth_profile_videos for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "profile video delete own" on public.youth_profile_videos for delete to authenticated
 using(user_id=(select auth.uid()));

-- Enforce attachment ownership/scope even against direct REST inserts. Published
-- video bytes cannot be overwritten. Require uploaded object before references.
create or replace function private.check_video_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.youth_videos; target uuid;
begin
 if tg_table_name='messages' then
  if new.video_kind is null then return new; end if;
 end if;
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if tg_table_name='youth_profile_videos' then
  if new.user_id <> auth.uid() then raise exception 'Owner required' using errcode='42501'; end if;
  target:=new.video_id;
 else
  if new.video_kind is null then return new; end if;
  if new.sender_user_id <> auth.uid() or not exists(select 1 from public.conversations c
    where c.id=new.conversation_id and c.youth_user_id=auth.uid()) then
   raise exception 'Only the youth may share a video' using errcode='42501'; end if;
  if new.video_kind='profile' then
   select video_id into target from public.youth_profile_videos where user_id=auth.uid();
  else target:=new.video_id; end if;
 end if;
 select * into v from public.youth_videos where id=target and owner_id=auth.uid() and revoked_at is null;
 if v.id is null or (tg_table_name='youth_profile_videos' and v.conversation_id is not null) then
  raise exception 'Video unavailable or wrong scope' using errcode='42501'; end if;
 if tg_table_name='messages' then
  if new.video_kind='file' and v.conversation_id is distinct from new.conversation_id then
   raise exception 'Video belongs to another conversation' using errcode='42501'; end if;
 end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='youth-profile-videos' and o.name=v.storage_path
   and (o.metadata->>'size')::bigint between 1 and 31457280
   and o.metadata->>'mimetype'=v.mime_type) then
  raise exception 'Upload has not completed' using errcode='23514'; end if;
 return new;
end;
$$;
revoke all on function private.check_video_reference() from public, anon, authenticated;
create trigger check_profile_video before insert or update on public.youth_profile_videos
 for each row execute function private.check_video_reference();
create trigger check_message_video before insert or update on public.messages
 for each row execute function private.check_video_reference();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('youth-profile-videos','youth-profile-videos',false,31457280,array['video/mp4','video/webm','video/quicktime']);
create policy "private video upload registered" on storage.objects for insert to authenticated with check (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid()) and v.revoked_at is null)
);
create policy "private video read authorized" on storage.objects for select to authenticated using (
 bucket_id='youth-profile-videos' and private.video_object_readable(name)
);
create policy "private video delete revoked" on storage.objects for delete to authenticated using (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid()) and v.revoked_at is not null)
);
-- SELECT needed for storage deletion even after revocation, restricted to owner.
create policy "private video owner cleanup read" on storage.objects for select to authenticated using (
 bucket_id='youth-profile-videos' and (storage.foldername(name))[1]=(select auth.uid())::text
);

-- Capture which immutable video a message referred to at report time. This
-- augments the already-authorized report RPC, not a new reporting endpoint.
create or replace function private.capture_reported_video()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if new.target_type='message' and auth.uid()=new.reporter_user_id then
  select case when m.video_kind='file' then m.video_id else pv.video_id end into target
   from public.messages m join public.conversations c on c.id=m.conversation_id
   left join public.youth_profile_videos pv on pv.user_id=m.sender_user_id
   where m.id=new.target_id and m.video_kind is not null
    and auth.uid() in(c.youth_user_id,c.company_user_id)
    and not public.users_are_blocked(c.youth_user_id,c.company_user_id);
  if target is not null then
   new.target_snapshot:=coalesce(new.target_snapshot,'{}')||jsonb_build_object('video_id',target);
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.capture_reported_video() from public,anon,authenticated;
create trigger capture_reported_video before insert on public.moderation_reports
 for each row execute function private.capture_reported_video();
