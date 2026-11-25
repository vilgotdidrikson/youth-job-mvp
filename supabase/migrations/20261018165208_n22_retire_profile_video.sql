-- N22: retire profile-video access, retaining legacy metadata/bytes for scoped
-- cleanup under L12. No files, messages or original migrations are deleted.
-- The private bucket keeps its historical name: it also holds chat videos.
revoke all on public.youth_profile_videos from public, anon, authenticated;
drop policy "profile video read" on public.youth_profile_videos;
drop policy "profile video insert own" on public.youth_profile_videos;
drop policy "profile video update own" on public.youth_profile_videos;
drop policy "profile video delete own" on public.youth_profile_videos;

create or replace function private.can_read_youth_video(p_id uuid)
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

alter policy "video read authorized" on public.youth_videos using (
 conversation_id is not null and (owner_id=(select auth.uid()) or private.can_read_youth_video(id))
);
alter policy "video register own" on public.youth_videos with check (
 owner_id=(select auth.uid()) and conversation_id is not null and revoked_at is null
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth')
 and exists(select 1 from public.conversations c join public.matches m on m.id=c.match_id
  where c.id=conversation_id and c.youth_user_id=(select auth.uid())
    and m.status in('matched','in_contact','interview','hired')
    and not public.users_are_blocked(c.youth_user_id,c.company_user_id))
);

alter policy "private video upload registered" on storage.objects with check (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid())
    and v.conversation_id is not null and v.revoked_at is null)
);
-- The former owner-prefix exception also allowed signing retired profile files.
-- Keep owner cleanup for chat files (including revoked uploads) only.
alter policy "private video owner cleanup read" on storage.objects using (
 bucket_id='youth-profile-videos' and exists(select 1 from public.youth_videos v
  where v.storage_path=name and v.owner_id=(select auth.uid()) and v.conversation_id is not null)
);

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
  where id=new.video_id and owner_id=auth.uid() and revoked_at is null;
 if v.id is null or v.conversation_id is distinct from new.conversation_id then
  raise exception 'Video unavailable or wrong conversation' using errcode='42501';
 end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='youth-profile-videos' and o.name=v.storage_path
   and (o.metadata->>'size')::bigint between 1 and 31457280 and o.metadata->>'mimetype'=v.mime_type) then
  raise exception 'Upload has not completed' using errcode='23514';
 end if;
 return new;
end;
$$;
-- Existing function privileges, report snapshots and account-deletion cleanup
-- remain intact. Already-issued signed URLs can last up to their original TTL.
