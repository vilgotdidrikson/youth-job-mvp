-- ONLY DevStaging. Fixture writes/trigger setup roll back. No real media bytes.
begin;
do $$
declare
 youth uuid := '40416000-07aa-4416-9098-fb4be9928558';
 company uuid := '120c7407-1e8a-488c-9047-f52d79325011';
 outsider uuid := '875c6885-ffbb-4a74-99a8-aac3cd194e84';
 conv uuid := '6fa2dac2-c31f-4f31-b245-5489a04ed394';
 foreign_conv uuid := '40652481-8beb-4739-ac80-9e9155b7db6f';
 legacy uuid := gen_random_uuid(); chat uuid := gen_random_uuid(); draft uuid := gen_random_uuid();
 msg uuid := gen_random_uuid(); shared uuid := gen_random_uuid(); report_id uuid;
 p_path text; c_path text; affected integer;
begin
 perform set_config('storage.operation','object.get_authenticated',true);
 if not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson') or
    not exists(select 1 from public.company_profiles where user_id=company and company_name like 'QA Bistro%') or
    not exists(select 1 from public.conversations c join public.matches m on m.id=c.match_id
      where c.id=conv and c.youth_user_id=youth and c.company_user_id=company
        and m.status in('matched','in_contact','interview','hired')
        and not public.users_are_blocked(youth,company)) then
  raise exception 'Missing fictional staging fixtures; refusing test';
 end if;
 p_path:=youth::text||'/'||legacy::text||'.mp4';
 c_path:=youth::text||'/'||chat::text||'.webm';
 -- Seed a pre-retirement asset and share as fixture owner. Only this trigger is
 -- bypassed for legacy fixture setup; re-enable before testing application roles.
 insert into public.youth_videos(id,owner_id,storage_path,mime_type,size_bytes,duration_seconds)
  values(legacy,youth,p_path,'video/mp4',100,30);
 insert into storage.objects(bucket_id,name,metadata)
  values('youth-profile-videos',p_path,'{"size":100,"mimetype":"video/mp4"}');
 alter table public.messages disable trigger check_message_video;
 insert into public.messages(id,conversation_id,sender_user_id,message_text,video_kind)
  values(shared,conv,youth,'QA retired profile share','profile');
 alter table public.messages enable trigger check_message_video;

 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 begin
  perform 1 from public.youth_profile_videos;
  raise exception 'FAIL old pointer table readable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.youth_profile_videos(user_id,video_id) values(youth,legacy);
  raise exception 'FAIL old profile pointer writable';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.youth_videos where id=legacy) then raise exception 'FAIL owner reads retired metadata'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=p_path) then raise exception 'FAIL owner signs retired file'; end if;
 if private.can_read_youth_video(legacy) or private.video_object_readable(p_path) then raise exception 'FAIL retired lookup allowed'; end if;
 begin
  insert into public.youth_videos(id,owner_id,storage_path,mime_type,size_bytes,duration_seconds)
   values(draft,youth,youth::text||'/'||draft::text||'.mp4','video/mp4',100,30);
  raise exception 'FAIL old client registers profile video';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name,metadata)
   values('youth-profile-videos',youth::text||'/'||legacy::text||'.mov','{"size":100,"mimetype":"video/quicktime"}');
  raise exception 'FAIL unregistered object upload';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind)
   values(conv,youth,'QA retired share attempt','profile');
  raise exception 'FAIL old profile share accepted';
 exception when feature_not_supported then null; end;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(conv,youth,'QA legacy as file','file',legacy);
  raise exception 'FAIL retired video reused in chat';
 exception when insufficient_privilege then null; end;
 insert into public.youth_videos(id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds)
  values(chat,youth,conv,c_path,'video/webm',100,15),
        (draft,youth,conv,youth::text||'/'||draft::text||'.mp4','video/mp4',100,30);
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(conv,youth,'QA incomplete upload','file',draft);
  raise exception 'FAIL incomplete upload shared';
 exception when check_violation then null; end;
 insert into storage.objects(bucket_id,name,metadata)
  values('youth-profile-videos',c_path,'{"size":100,"mimetype":"video/webm"}');
 insert into public.messages(id,conversation_id,sender_user_id,message_text,video_kind,video_id)
  values(msg,conv,youth,'QA separate chat video','file',chat);
 update storage.objects set metadata='{"size":200,"mimetype":"video/webm"}' where name=c_path and bucket_id='youth-profile-videos';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL immutable video changed'; end if;
 begin
  update public.youth_videos set conversation_id=foreign_conv where id=chat;
  raise exception 'FAIL video scope mutable';
 exception when insufficient_privilege then null; end;

 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.youth_videos where id=chat) then raise exception 'FAIL chat recipient cannot read'; end if;
 if exists(select 1 from public.youth_videos where id in(legacy,draft)) then raise exception 'FAIL retired/draft recipient leak'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name in(p_path,c_path)) then raise exception 'FAIL direct storage bypass'; end if;
 if not private.can_read_youth_video(chat) then raise exception 'FAIL authorized playback scope'; end if;
 if not exists(select 1 from public.messages where id=shared and video_kind='profile') then raise exception 'FAIL old message lost'; end if;
 update public.youth_videos set revoked_at=now() where id=chat;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL company revoked media'; end if;
 report_id:=public.submit_moderation_report('message',msg,'inappropriate','Fiktivt N22-test, återställs');
 reset role;
 if (select target_snapshot->>'video_id' from public.moderation_reports where id=report_id)<>chat::text then raise exception 'FAIL report reference lost'; end if;

 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.youth_videos where id in(legacy,chat,draft)) then raise exception 'FAIL outsider metadata leak'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name in(p_path,c_path)) then raise exception 'FAIL outsider file leak'; end if;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(foreign_conv,outsider,'QA cross-chat attach','file',chat);
  raise exception 'FAIL cross-conversation attach';
 exception when insufficient_privilege then null; end;

 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.user_blocks(blocker_user_id,blocked_user_id) values(company,youth) on conflict do nothing;
 if exists(select 1 from public.youth_videos where id=chat) then raise exception 'FAIL blocked recipient reads'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=c_path) then raise exception 'FAIL blocked storage'; end if;

 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(conv,youth,'QA blocked send','file',chat);
  raise exception 'FAIL blocked youth sends';
 exception when insufficient_privilege then null; end;
 update public.youth_videos set revoked_at=now() where id=chat;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=c_path) then raise exception 'FAIL revoked bytes accessible'; end if;
 -- Real Storage deletion must use the Storage API. This rollback-only SQL
 -- fixture verifies revocation; only the service worker deletes physical objects.
 reset role;
 -- Nothing retired is deleted by this feature, including moderation evidence.
 if not exists(select 1 from public.youth_videos where id=legacy) or
    not exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=p_path) or
    not exists(select 1 from public.messages where id=shared) then raise exception 'FAIL retired history deleted'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 set local role anon;
 begin
  perform 1 from public.youth_videos;
  raise exception 'FAIL anonymous metadata';
 exception when insufficient_privilege then null; end;
 reset role;
end $$;
rollback;
select 'PASS N22: retired metadata/pointers/files/shares denied; chat upload, participant, outsider, block, immutable scope, incomplete upload, revocation, report and legacy preservation. All writes rolled back.' as result;
