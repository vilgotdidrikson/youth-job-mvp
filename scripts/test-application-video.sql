-- Run only in DevStaging. The fixtures and worker configuration are rolled back.
begin;
do $$
declare
 youth constant uuid := '40416000-07aa-4416-9098-fb4be9928558';
 company constant uuid := '120c7407-1e8a-488c-9047-f52d79325011';
 job constant uuid := '765be68c-7d32-4bc5-859d-6a077ff81a8b';
 outsider uuid := gen_random_uuid();
 video uuid := gen_random_uuid();
 path text;
 deadline timestamptz;
 lease uuid;
begin
 if not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson')
    or not exists(select 1 from public.jobs j join public.company_profiles c on c.user_id=j.company_user_id
                  where j.id=job and j.company_user_id=company and c.company_name like 'QA Bistro%')
    or not private.application_video_eligible(job,youth) then
   raise exception 'Missing fictional application fixture';
 end if;
 update private.video_cleanup_config set enabled=false where singleton;
 update public.jobs set application_video_prompt='QA: Berätta kort om dig själv.' where id=job;

 perform set_config('request.jwt.claim.sub',youth::text,true);
 set local role authenticated;
 if public.get_application_video(job)->>'prompt' is not null then
   raise exception 'Cleanup disabled but prompt is visible';
 end if;
 begin
   perform public.manage_application_video(job,video,'reserve','video/mp4',100,1);
   raise exception 'Cleanup disabled but upload is reservable';
 exception when insufficient_privilege then null; end;
 reset role;

 -- Exercise the enabled path without calling the dispatcher or writing Storage bytes.
 update private.video_cleanup_config set enabled=true,endpoint='https://qa.invalid/cleanup' where singleton;
 set local role authenticated;
 if public.get_application_video(job)->>'prompt' is distinct from 'QA: Berätta kort om dig själv.' then
   raise exception 'Applicant cannot see instructions';
 end if;
 path := public.manage_application_video(job,video,'reserve','video/mp4',100,1);
 begin
   perform public.manage_application_video(job,video,'send');
   raise exception 'Unuploaded video could be sent';
 exception when invalid_parameter_value then null; end;
 insert into storage.objects(bucket_id,name,metadata)
 values('youth-profile-videos',path,'{"size":100,"mimetype":"video/mp4"}');

 perform set_config('request.jwt.claim.sub',company::text,true);
 if public.get_application_video(job,youth)->>'videoId' is not null
    or exists(select 1 from public.youth_videos where id=video) then
   raise exception 'Recipient can see a draft';
 end if;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 if public.manage_application_video(job,video,'send') is distinct from 'sent'
    or public.manage_application_video(job,video,'send') is distinct from 'sent' then
   raise exception 'Send or retry failed';
 end if;
 select expires_at into deadline from public.youth_videos
 where id=video and expires_at=first_sent_at+interval '14 days';
 if deadline is null then raise exception 'Wrong retention deadline'; end if;

 perform set_config('request.jwt.claim.sub',company::text,true);
 if public.get_application_video(job,youth)->>'videoId' is distinct from video::text
    or not exists(select 1 from public.youth_videos where id=video) then
   raise exception 'Recipient cannot see sent video';
 end if;
 perform set_config('storage.operation','object.sign',true);
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=path) then
   raise exception 'Recipient can sign a direct link';
 end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if public.get_application_video(job,youth) is not null
    or exists(select 1 from public.youth_videos where id=video) then
   raise exception 'Unrelated account can see video';
 end if;
 reset role;

 insert into public.user_blocks(blocker_user_id,blocked_user_id) values(youth,company);
 perform set_config('request.jwt.claim.sub',company::text,true);
 set local role authenticated;
 if exists(select 1 from public.youth_videos where id=video) then
   raise exception 'Blocked recipient can see video';
 end if;
 reset role;
 delete from public.user_blocks where blocker_user_id=youth and blocked_user_id=company;

 begin
   update public.application_completions set status='withdrawn',withdrawn_at=statement_timestamp()
   where job_id=job and youth_user_id=youth;
   set local role authenticated;
   if exists(select 1 from public.youth_videos where id=video) then
     raise exception 'Recipient can see video after withdrawal';
   end if;
   raise exception using errcode='Q0001', message='Roll back fixture withdrawal';
 exception when sqlstate 'Q0001' then null;
 end;
 update public.youth_videos set expires_at=statement_timestamp() where id=video;

 set local role authenticated;
 if exists(select 1 from public.youth_videos where id=video) then
   raise exception 'Expired video is visible';
 end if;
 reset role;
 set local role service_role;
 select lock_token into lease from public.claim_video_cleanup(20) where video_id=video;
 if lease is null then raise exception 'Expired application video was not claimed'; end if;
 -- Test worker acknowledgement. No physical bytes exist for this fixture.
 if not public.finish_video_cleanup(video,lease,true) then raise exception 'Cleanup acknowledgement failed'; end if;
 reset role;
 if not exists(select 1 from public.youth_videos where id=video and deleted_at is not null
               and storage_path is null and mime_type is null and size_bytes is null and duration_seconds is null) then
   raise exception 'Cleanup did not scrub metadata';
 end if;
end;
$$;
rollback;
