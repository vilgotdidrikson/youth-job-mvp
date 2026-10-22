-- DevStaging only. All rows/leases roll back; Storage bytes are tested separately.
begin;
do $$
declare
 youth uuid:='40416000-07aa-4416-9098-fb4be9928558';
 company uuid:='120c7407-1e8a-488c-9047-f52d79325011';
 conv uuid:='6fa2dac2-c31f-4f31-b245-5489a04ed394';
 vid uuid:=gen_random_uuid(); draft uuid:=gen_random_uuid();
 held uuid:=gen_random_uuid(); msg uuid:=gen_random_uuid();
 path text; deadline timestamptz; sent timestamptz; lease uuid; old_lease uuid; report_id uuid;
 jobs record;
begin
 if not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson')
 or not exists(select 1 from public.company_profiles where user_id=company and company_name like 'QA Bistro%')
 or not exists(select 1 from public.conversations c join public.matches m on m.id=c.match_id
 where c.id=conv and c.youth_user_id=youth and c.company_user_id=company
 and m.status in('matched','in_contact','interview','hired')) then
 raise exception 'Missing fictional staging fixtures'; end if;
 path:=youth::text||'/'||vid::text||'.mp4';
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.youth_videos(id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds)
 values(vid,youth,conv,path,'video/mp4',100,10),
 (draft,youth,conv,youth::text||'/'||draft::text||'.mp4','video/mp4',100,10),
 (held,youth,conv,youth::text||'/'||held::text||'.mp4','video/mp4',100,10);
 if not exists(select 1 from public.youth_videos where id=draft and first_sent_at is null
 and expires_at=created_at+interval '24 hours') then raise exception 'FAIL draft deadline'; end if;
 begin
 update public.youth_videos set expires_at=now()+interval '1 year' where id=vid;
 raise exception 'FAIL mutable deadline';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.youth_videos(owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds,created_at)
 values(youth,conv,path,'video/mp4',100,10,now());
 raise exception 'FAIL client-supplied upload time';
 exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name,metadata) values
 ('youth-profile-videos',path,'{"size":100,"mimetype":"video/mp4"}'),
 ('youth-profile-videos',youth::text||'/'||held::text||'.mp4','{"size":100,"mimetype":"video/mp4"}');
 insert into public.messages(id,conversation_id,sender_user_id,message_text,video_kind,video_id,created_at)
 values(msg,conv,youth,'QA L12 video','file',vid,now()+interval '1 year');
 select first_sent_at,expires_at into sent,deadline from public.youth_videos where id=vid;
 if sent<>statement_timestamp() or deadline<>sent+interval '14 days' then raise exception 'FAIL server send time'; end if;
 insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
 values(conv,youth,'QA L12 second reference','file',vid), (conv,youth,'QA L12 held','file',held);
 if (select expires_at from public.youth_videos where id=vid)<>deadline then raise exception 'FAIL share extended expiry'; end if;
 perform set_config('storage.operation','object.get_authenticated',true);
 if not exists(select 1 from storage.objects where name=path and bucket_id='youth-profile-videos') then raise exception 'FAIL download before expiry'; end if;
 perform set_config('storage.operation','object.sign',true);
 if exists(select 1 from storage.objects where name=path and bucket_id='youth-profile-videos') then raise exception 'FAIL signing allowed'; end if;
 perform set_config('storage.operation','object.list',true);
 if exists(select 1 from storage.objects where name=path and bucket_id='youth-profile-videos') then raise exception 'FAIL listing allowed'; end if;
 begin
 perform * from public.claim_video_cleanup(20);
 raise exception 'FAIL owner calls cleanup';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 perform set_config('storage.operation','object.get_authenticated',true);
 if not private.can_read_youth_video(vid) then raise exception 'FAIL recipient before expiry'; end if;
 report_id:=public.submit_moderation_report('message',(select id from public.messages where video_id=held limit 1),'inappropriate','QA L12 report, rolled back');
 reset role;
 -- Exactly at the boundary: deny byte access, retain neutral message metadata.
 update public.youth_videos set expires_at=statement_timestamp() where id in(vid,draft,held);
 set local role authenticated;
 if private.can_read_youth_video(vid) or exists(select 1 from storage.objects where name=path and bucket_id='youth-profile-videos') then raise exception 'FAIL access at expiry'; end if;
 if not exists(select 1 from public.youth_videos where id=vid and expires_at=statement_timestamp()) then raise exception 'FAIL expiry metadata unavailable to recipient'; end if;
 reset role;
 update public.youth_videos set expires_at=statement_timestamp()-interval '1 second' where id=vid;
 set local role authenticated;
 if private.can_read_youth_video(vid) then raise exception 'FAIL access after expiry'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 begin
 insert into storage.objects(bucket_id,name,metadata) values('youth-profile-videos',youth::text||'/'||draft::text||'.mp4','{"size":100,"mimetype":"video/mp4"}');
 raise exception 'FAIL expired draft upload';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id)
 values(conv,youth,'QA expired re-share','file',vid);
 raise exception 'FAIL expired re-share';
 exception when insufficient_privilege then null; end;
 reset role;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform set_config('request.jwt.claim.sub','',true);
 set local role service_role;
 for jobs in select * from public.claim_video_cleanup(20) loop
  if jobs.video_id=held then raise exception 'FAIL report bytes selected'; end if;
  if jobs.video_id=vid then lease:=jobs.lock_token; end if;
 end loop;
 if lease is null then raise exception 'FAIL expired video not claimed'; end if;
 if exists(select 1 from public.claim_video_cleanup(20) where video_id=vid) then raise exception 'FAIL duplicate lease'; end if;
 if public.finish_video_cleanup(vid,gen_random_uuid(),true) then raise exception 'FAIL wrong lease accepted'; end if;
 old_lease:=lease;
 reset role;
 update private.video_cleanup_jobs set locked_until=statement_timestamp()-interval '1 second' where video_id=vid;
 set local role service_role;
 select lock_token into lease from public.claim_video_cleanup(20) where video_id=vid;
 if lease is null or lease=old_lease then raise exception 'FAIL abandoned lease not recovered'; end if;
 if public.finish_video_cleanup(vid,old_lease,true) then raise exception 'FAIL abandoned lease accepted'; end if;
 if not public.finish_video_cleanup(vid,lease,false) then raise exception 'FAIL failure not recorded'; end if;
 if exists(select 1 from public.claim_video_cleanup(20) where video_id=vid) then raise exception 'FAIL no retry backoff'; end if;
 reset role;
 update private.video_cleanup_jobs set next_attempt_at=now()-interval '1 minute' where video_id=vid;
 set local role service_role;
 select lock_token into lease from public.claim_video_cleanup(20) where video_id=vid;
 if lease is null then raise exception 'FAIL retry not claimed'; end if;
 -- Simulate a successful Storage removal; do not DELETE storage.objects via SQL.
 if not public.finish_video_cleanup(vid,lease,true) then raise exception 'FAIL completion'; end if;
 if public.finish_video_cleanup(vid,lease,true) then raise exception 'FAIL stale completion accepted'; end if;
 reset role;
 if not exists(select 1 from public.youth_videos where id=vid and deleted_at is not null
 and storage_path is null and mime_type is null and size_bytes is null and duration_seconds is null) then raise exception 'FAIL metadata not scrubbed'; end if;
 if (select count(*) from public.messages where video_id=vid)<>2 then raise exception 'FAIL message references lost'; end if;
 if not exists(select 1 from public.youth_videos where id=held and cleanup_started_at is null and deleted_at is null) then raise exception 'FAIL report mutated'; end if;
end; $$;
rollback;
