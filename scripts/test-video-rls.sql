-- ONLY MatchnWork DevStaging (vwcfjvwfeatvuisojwrh). Fictional existing QA
-- identities. Every write, notification and simulated object row rolls back.
-- This exercises PostgreSQL RLS/triggers, NOT real storage bytes or playback.
begin;
do $$
declare
 youth uuid := '40416000-07aa-4416-9098-fb4be9928558';
 company uuid := '120c7407-1e8a-488c-9047-f52d79325011';
 outsider uuid := '875c6885-ffbb-4a74-99a8-aac3cd194e84';
 conv uuid := '6fa2dac2-c31f-4f31-b245-5489a04ed394';
 foreign_conv uuid := '40652481-8beb-4739-ac80-9e9155b7db6f';
 profile_video uuid := gen_random_uuid(); chat_video uuid := gen_random_uuid(); draft_video uuid := gen_random_uuid();
 msg uuid := gen_random_uuid(); shared uuid := gen_random_uuid(); report_id uuid;
 p_path text; c_path text; affected integer;
begin
 if not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson') or
    not exists(select 1 from public.company_profiles where user_id=company and company_name like 'QA Bistro%') then
  raise exception 'Missing fictional staging fixtures; refusing test';
 end if;
 p_path:=youth::text||'/'||profile_video::text||'.mp4';
 c_path:=youth::text||'/'||chat_video::text||'.webm';
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.youth_videos(id,owner_id,storage_path,mime_type,size_bytes,duration_seconds)
  values(profile_video,youth,p_path,'video/mp4',100,30),
   (draft_video,youth,youth::text||'/'||draft_video::text||'.mp4','video/mp4',100,30);
 insert into public.youth_videos(id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds)
  values(chat_video,youth,conv,c_path,'video/webm',100,15);
 begin
  insert into public.youth_videos(owner_id,storage_path,mime_type,size_bytes,duration_seconds)
   values(outsider,'invalid','video/mp4',100,30);
  raise exception 'FAIL foreign owner accepted';
 exception when insufficient_privilege or check_violation then null; end;
 begin
  insert into public.youth_profile_videos(user_id,video_id) values(youth,draft_video);
  raise exception 'FAIL incomplete upload published';
 exception when check_violation then null; end;
 insert into storage.objects(bucket_id,name,metadata) values
  ('youth-profile-videos',p_path,'{"size":100,"mimetype":"video/mp4"}'),
  ('youth-profile-videos',c_path,'{"size":100,"mimetype":"video/webm"}');
 -- A temporary override stays within this rolled-back fixture transaction.
 insert into public.youth_profile_videos(user_id,video_id) values(youth,profile_video)
  on conflict(user_id) do update set video_id=excluded.video_id;
 insert into public.messages(id,conversation_id,sender_user_id,message_text,video_kind,video_id)
  values(msg,conv,youth,'QA video RLS','file',chat_video),
        (shared,conv,youth,'QA profile sharing','profile',null);
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(conv,youth,'QA wrong scope','file',profile_video);
  raise exception 'FAIL profile asset accepted as separate chat video';
 exception when insufficient_privilege then null; end;
 begin
  update public.youth_videos set owner_id=outsider where id=chat_video;
  raise exception 'FAIL metadata identity mutable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_id)
   values(conv,youth,'QA invalid video shape',chat_video);
  raise exception 'FAIL missing video kind accepted';
 exception when check_violation then null; end;
 update storage.objects set metadata='{"size":200,"mimetype":"video/mp4"}' where bucket_id='youth-profile-videos' and name=p_path;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL published bytes mutable'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.youth_videos where id=profile_video) then raise exception 'FAIL applicant profile video unreadable'; end if;
 if not exists(select 1 from public.youth_videos where id=chat_video) then raise exception 'FAIL chat participant video unreadable'; end if;
 if exists(select 1 from public.youth_videos where id=draft_video) then raise exception 'FAIL draft exposed'; end if;
 if (select count(*) from storage.objects where bucket_id='youth-profile-videos' and name in(p_path,c_path))<>2 then raise exception 'FAIL storage participant read'; end if;
 update public.youth_videos set revoked_at=now() where id=chat_video;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL company revoked youth media'; end if;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind)
   values(conv,company,'QA forged share','profile');
  raise exception 'FAIL company forged profile share';
 exception when insufficient_privilege then null; end;
 report_id:=public.submit_moderation_report('message',msg,'inappropriate','Fiktivt transaktionstest, återställs');
 reset role;
 if (select target_snapshot->>'video_id' from public.moderation_reports where id=report_id)<>chat_video::text then
  raise exception 'FAIL report video reference missing'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.youth_videos where id in(profile_video,chat_video,draft_video)) then raise exception 'FAIL unrelated youth read'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name in(p_path,c_path)) then raise exception 'FAIL unrelated storage read'; end if;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
   values(foreign_conv,outsider,'QA cross-chat leak','file',chat_video);
  raise exception 'FAIL cross-conversation attachment accepted';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.user_blocks(blocker_user_id,blocked_user_id) values(company,youth) on conflict do nothing;
 if exists(select 1 from public.youth_videos where id in(profile_video,chat_video)) then raise exception 'FAIL blocked recipient read'; end if;
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name in(p_path,c_path)) then raise exception 'FAIL blocked storage read'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 begin
  insert into public.messages(conversation_id,sender_user_id,message_text,video_kind)
   values(conv,youth,'QA blocked send','profile');
  raise exception 'FAIL blocked sender sent video';
 exception when insufficient_privilege then null; end;
 update public.youth_videos set revoked_at=now() where id in(profile_video,chat_video);
 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.youth_videos where id in(profile_video,chat_video)) then raise exception 'FAIL revoked asset read'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 set local role anon;
 begin
  perform 1 from public.youth_videos;
  raise exception 'FAIL anon table access';
 exception when insufficient_privilege then null; end;
 reset role;
end $$;
rollback;
select 'PASS video RLS: owner, participant, outsider, cross-chat, blocked, revoked, draft, immutable, reporting, anonymous. All writes rolled back.' as result;
