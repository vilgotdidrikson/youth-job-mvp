-- DevStaging only; new fictional actors and every row/notification/lease roll back.
begin;
create temporary table l05_results(result jsonb);
do $$
declare
 u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); other_c uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
 job uuid:=gen_random_uuid(); other_job uuid:=gen_random_uuid(); paused uuid:=gen_random_uuid(); closed_job uuid:=gen_random_uuid(); draft_job uuid:=gen_random_uuid();
 v_match_id uuid:=gen_random_uuid(); conv uuid; message uuid:=gen_random_uuid(); vid uuid:=gen_random_uuid();
 report uuid; again uuid; message_report uuid; video_report uuid; p jsonb; packet jsonb; item record;
 before_time timestamptz; n int; checks text[]:='{}'; changed int; path text;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
  (u,'qa-l05-'||u||'@example.invalid','{"role":"youth"}'),
  (outsider,'qa-l05-'||outsider||'@example.invalid','{"role":"youth"}'),
  (c,'qa-l05-'||c||'@example.invalid','{"role":"company"}'),
  (other_c,'qa-l05-'||other_c||'@example.invalid','{"role":"company"}'),
  (a,'qa-l05-'||a||'@example.invalid','{"role":"private"}');
 insert into public.admin_users(user_id) values(a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 update public.company_profiles set company_name='QA L05 fictional',verification_status='verified' where user_id in(c,other_c);
 update public.youth_profiles set full_name='QA L05 youth',cv_generated=true,
  cv_text='QA L05 CV. Jag har arbetat med service och kan arbeta på helger.',address='PRIVATE_L05_HOME',
  recruitment_profile=jsonb_set(recruitment_profile,'{preferences,motivation}','"PRIVATE_L05_MOTIVATION"') where user_id=u;
 insert into public.jobs(id,company_user_id,company_name,title,description,address) values
  (job,c,'QA L05','QA L05 active','QA fictional work','QA Gatan 1'),
  (other_job,c,'QA L05','QA L05 other application','QA fictional work','QA Gatan 2'),
  (paused,c,'QA L05','QA L05 paused','PRIVATE_L05_PAUSED','QA Gatan 3'),
  (draft_job,c,'QA L05','QA L05 draft','PRIVATE_L05_DRAFT','QA Gatan 4'),
  (closed_job,c,'QA L05','QA L05 closed','PRIVATE_L05_CLOSED','QA Gatan 5');
 update public.jobs set status='paused',is_active=false where id=paused;
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(closed_job,c,'no_hire');
 update public.jobs set status='closed',is_active=false where id=closed_job;
 update public.jobs set publication_status='pending_verification' where id=draft_job;
 insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions)
  values(job,'approved','QA L05 role','[]','[]');
 insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(v_match_id,u,c,job,'matched');
 select id into conv from public.conversations where public.conversations.match_id=v_match_id;
 if conv is null then insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(v_match_id,u,c,job) returning id into conv; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 p:=public.get_my_application_disclosure_preview(job,'{}');
 perform public.save_my_application_disclosure(job,'{}',p->>'source_token');
 perform public.prepare_my_application(job);
 -- Normal chat and video remain possible before a block.
 insert into public.messages(id,conversation_id,sender_user_id,message_text) values(message,conv,u,'QA L05 first message');
 path:=u::text||'/'||vid::text||'.mp4';
 insert into public.youth_videos(id,owner_id,conversation_id,storage_path,mime_type,size_bytes,duration_seconds) values(vid,u,conv,path,'video/mp4',100,10);
 insert into storage.objects(bucket_id,name,metadata) values('youth-profile-videos',path,'{"size":100,"mimetype":"video/mp4"}');
 insert into public.messages(conversation_id,sender_user_id,message_text,video_kind,video_id) values(conv,u,'QA L05 video','file',vid);
 report:=public.submit_moderation_report('conversation',conv,'harassment','QA fictional report');
 again:=public.submit_moderation_report('conversation',conv,'harassment','QA duplicate');
 if report<>again then raise exception 'Duplicate submission created two cases'; end if;
 if (select count(*) from public.moderation_reports where target_id=conv and reporter_user_id=u)<>1 then raise exception 'Duplicate case rows'; end if;
 checks:=array_append(checks,'authorized reporting and duplicate submission');
 begin perform public.get_moderation_casework(); raise exception 'Youth read admin cases'; exception when insufficient_privilege then null; end;
 begin perform public.review_moderation_report(report,'resolved','forged'); raise exception 'Youth reviewed case'; exception when insufficient_privilege then null; end;
 begin update public.moderation_reports set status='resolved' where id=report; raise exception 'Direct reporter update accepted'; exception when insufficient_privilege then null; end;
 checks:=array_append(checks,'reporter cannot administer cases');
 begin perform public.submit_moderation_report('job',paused,'privacy'); raise exception 'Unrelated paused job exposed'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('job',closed_job,'privacy'); raise exception 'Unrelated closed job exposed'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('job',draft_job,'privacy'); raise exception 'Draft job exposed'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('job',job,null); raise exception 'Null reason accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_moderation_report(null,job,'privacy'); raise exception 'Null target accepted'; exception when invalid_parameter_value then null; end;
 checks:=array_append(checks,'paused/closed/draft target and invalid input protection');
 -- A block stops new messages in both directions but retains historical reporting.
 perform public.block_conversation_user(conv);
 begin insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,u,'QA blocked send'); raise exception 'Blocker sent message'; exception when insufficient_privilege then null; end;
 message_report:=public.submit_moderation_report('message',message,'harassment','QA after block');
 if message_report is null then raise exception 'Reporting blocked conversation unavailable'; end if;
 checks:=array_append(checks,'blocker cannot send and can still report');
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 begin insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,c,'QA reverse blocked send'); raise exception 'Blocked company sent'; exception when insufficient_privilege then null; end;
 begin perform public.get_application_disclosure(job,u); raise exception 'Blocked company read disclosure'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.application_completions ac where ac.job_id=job and ac.youth_user_id=u) then raise exception 'Blocked company read application'; end if;
 if exists(select 1 from public.youth_profiles where user_id=u) then raise exception 'Company read general profile'; end if;
 if private.can_read_youth_video(vid) then raise exception 'Blocked company reads video'; end if;
 video_report:=public.submit_moderation_report('conversation',conv,'privacy','QA reverse report after block');
 if not exists(select 1 from public.moderation_reports r where r.id=video_report and private.report_references_video(r.target_snapshot,vid)) then raise exception 'Conversation report lost video evidence'; end if;
 checks:=array_append(checks,'bilateral block protects application/profile/video and preserves report evidence');
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 if public.users_are_blocked(u,c) then raise exception 'Third party learned block relationship'; end if;
 if exists(select 1 from public.user_blocks where blocker_user_id=u) then raise exception 'Third party read block rows'; end if;
 if exists(select 1 from public.messages where conversation_id=conv) or exists(select 1 from public.conversations where id=conv) or exists(select 1 from public.matches where id=v_match_id) then raise exception 'Outsider read recruitment communication'; end if;
 if exists(select 1 from public.youth_profiles where user_id=u) or exists(select 1 from public.moderation_reports where id=report) then raise exception 'Outsider read private profile/report'; end if;
 begin perform public.block_conversation_user(conv); raise exception 'Outsider blocked via foreign conversation'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('message',message,'privacy'); raise exception 'Outsider report read foreign message'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('conversation',conv,'privacy'); raise exception 'Outsider report read foreign conversation'; exception when insufficient_privilege then null; end;
 begin perform public.submit_moderation_report('user',u,'privacy'); raise exception 'Outsider report read foreign user'; exception when insufficient_privilege then null; end;
 begin perform public.get_application_disclosure(job,u); raise exception 'Outsider read disclosure'; exception when insufficient_privilege then null; end;
 begin perform public.get_moderation_casework(); raise exception 'Outsider read admin casework'; exception when insufficient_privilege then null; end;
 perform set_config('storage.operation','object.get_authenticated',true);
 if exists(select 1 from storage.objects where bucket_id='youth-profile-videos' and name=path) then raise exception 'Outsider reads video object'; end if;
 checks:=array_append(checks,'unrelated youth cannot read profiles, matches, chats, reports, disclosure, blocks or video');
 perform set_config('request.jwt.claim.sub',other_c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_c,'role','authenticated')::text,true);
 begin perform public.get_application_disclosure(job,u); raise exception 'Wrong company read disclosure'; exception when insufficient_privilege then null; end;
 begin perform * from public.get_company_candidates(job); raise exception 'Wrong company read candidates'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.application_completions ac where ac.job_id=job) then raise exception 'Wrong company read applications'; end if;
 checks:=array_append(checks,'wrong company denied candidates and application underlay');
 -- Reciprocal blocking: removing one side never removes the other side's block.
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 perform public.block_conversation_user(conv);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.unblock_user(c);
 if not public.users_are_blocked(u,c) then raise exception 'One-sided unblock bypassed reciprocal block'; end if;
 begin insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,u,'QA still blocked'); raise exception 'Reciprocal block bypassed'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 perform public.unblock_user(u);
 if public.users_are_blocked(u,c) then raise exception 'Unblock did not restore contact'; end if;
 insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,c,'QA contact restored');
 packet:=public.get_application_disclosure(job,u);
 if packet::text like '%PRIVATE_L05_%' then raise exception 'Disclosure leaked unshared facts'; end if;
 if packet->'cv'->>'text' not like 'QA L05 CV%' then raise exception 'Shared CV missing'; end if;
 begin perform public.get_application_disclosure(other_job,u); raise exception 'Wrong job read same candidate'; exception when insufficient_privilege then null; end;
 checks:=array_append(checks,'reciprocal unblock and restored job-specific shared CV');
 -- Final decisions are auditable and idempotent; ordinary reporters never see admin notes.
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.review_moderation_report_checked(report,'reviewing','open',null);
 begin perform public.review_moderation_report_checked(report,'dismissed','open','stale'); raise exception 'Stale admin decision accepted'; exception when sqlstate 'PT409' then null; end;
 perform public.review_moderation_report_checked(report,'resolved','reviewing','QA ADMIN PRIVATE DECISION');
 select reviewed_at into before_time from public.moderation_reports where id=report;
 perform public.review_moderation_report_checked(report,'resolved','reviewing','QA ADMIN PRIVATE DECISION');
 perform public.review_moderation_report(report,'resolved','QA ADMIN PRIVATE DECISION');
 if (select reviewed_at from public.moderation_reports where id=report) is distinct from before_time then raise exception 'Retry changed original timestamp'; end if;
 reset role;
 select count(*) into n from public.notifications where user_id=u and type='moderation_report';
 set local role authenticated;
 if n<>1 then raise exception 'Expected one terminal notification, found %',n; end if;
 begin perform public.review_moderation_report(report,'reviewing',null); raise exception 'Legacy client reopened final decision'; exception when sqlstate 'PT409' then null; end;
 if not exists(select 1 from public.get_moderation_casework() r where r.id=report and r.resolution_note='QA ADMIN PRIVATE DECISION' and r.reviewed_by_user_id=a) then raise exception 'Admin decision missing from casework'; end if;
 if not private.can_read_youth_video(vid) then raise exception 'Admin cannot access reported live video'; end if;
 checks:=array_append(checks,'admin status conflict, finality, original reviewer/time, one notification and visible saved decision');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 begin perform resolution_note from public.moderation_reports where id=report; raise exception 'Reporter read private admin note'; exception when insufficient_privilege then null; end;
 if not exists(select 1 from public.moderation_reports where id=report and status='resolved') then raise exception 'Reporter lost own case status'; end if;
 checks:=array_append(checks,'reporter status visible and internal decision note denied');
 -- Reporting does not extend the ordinary playback deadline, but cleanup retains evidence.
 reset role;
 update public.youth_videos set expires_at=statement_timestamp()-interval '1 second' where id=vid;
 set local role authenticated;
 if private.can_read_youth_video(vid) then raise exception 'Report extended video playback'; end if;
 reset role; set local role service_role;
 if exists(select 1 from public.claim_video_cleanup(20) x where x.video_id=vid) then raise exception 'Cleanup claimed conversation-reported video'; end if;
 checks:=array_append(checks,'reported video retained without extending playback');
 reset role;
 perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 begin perform public.submit_moderation_report('job',job,'privacy'); raise exception 'Anonymous submitted report'; exception when insufficient_privilege then null; end;
 begin perform public.get_moderation_casework(); raise exception 'Anonymous read cases'; exception when insufficient_privilege then null; end;
 begin perform public.users_are_blocked(u,c); raise exception 'Anonymous queried block relation'; exception when insufficient_privilege then null; end;
 checks:=array_append(checks,'anonymous denied privileged moderation RPCs');
 reset role;
 insert into l05_results values(jsonb_build_object('groups',cardinality(checks),'checks',checks,'fixture_users',5,'rollback',true));
end $$;
select result from l05_results;
rollback;
