-- DevStaging only. Synthetic rows, metadata (no physical files), flags and all
-- purges roll back. Never run against production or with an enabled scheduler.
begin;
create temporary table l12_results(result jsonb);
create temporary table l12_fail_target(job_id uuid);
create function pg_temp.fail_l12_packet_delete() returns trigger language plpgsql as $test$
begin
 if exists(select 1 from pg_temp.l12_fail_target where job_id=old.job_id) then raise exception 'QA injected retryable delete failure'; end if;
 return old;
end $test$;
create trigger qa_l12_delete_failure before delete on private.application_disclosures for each row execute function pg_temp.fail_l12_packet_delete();
do $$
declare
 u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); other_c uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid();
 j uuid:=gen_random_uuid(); active_job uuid:=gen_random_uuid(); retry_job uuid:=gen_random_uuid(); mid uuid:=gen_random_uuid(); active_mid uuid:=gen_random_uuid();
 conv uuid; active_conv uuid; packet jsonb; result jsonb; orig jsonb; checks text[]:='{}'; cv_path text:=u::text||'/qa-l12.pdf'; stamp timestamptz:=statement_timestamp();
 target uuid; report uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (u,'qa-l12-'||u||'@example.invalid','{"role":"youth"}'),(c,'qa-l12-'||c||'@example.invalid','{"role":"company"}'),
 (outsider,'qa-l12-'||outsider||'@example.invalid','{"role":"youth"}'),(other_c,'qa-l12-'||other_c||'@example.invalid','{"role":"company"}'),
 (admin,'qa-l12-'||admin||'@example.invalid','{"role":"private"}');
 insert into public.admin_users(user_id) values(admin);
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 update public.company_profiles set company_name='QA L12 company',verification_status='verified' where user_id in(c,other_c);
 update public.youth_profiles set full_name='QA L12 youth',cv_generated=true,cv_text='QA L12 CV: jag har serviceerfarenhet.',documents=jsonb_build_array(jsonb_build_object('type','cv','name','qa-l12.pdf','url',cv_path)) where user_id=u;
 select to_jsonb(y) into orig from public.youth_profiles y where user_id=u;
 insert into storage.objects(bucket_id,name,metadata) values('youth-documents',cv_path,'{"size":100,"mimetype":"application/pdf"}');
 insert into public.jobs(id,company_user_id,company_name,title,description,address) values
 (j,c,'QA L12','QA L12 closed','QA role','QA Gatan 1'),(active_job,c,'QA L12','QA L12 active','QA role','QA Gatan 2'),(retry_job,c,'QA L12','QA L12 retry','QA role','QA Gatan 3');
 insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions)
 select x,'approved','QA role','[]'::jsonb,'[]'::jsonb from unnest(array[j,active_job,retry_job]) x;
 insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(mid,u,c,j,'matched'),(active_mid,u,c,active_job,'matched');
 select id into conv from public.conversations where match_id=mid;select id into active_conv from public.conversations where match_id=active_mid;
 if conv is null then insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(mid,u,c,j) returning id into conv; end if;
 if active_conv is null then insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(active_mid,u,c,active_job) returning id into active_conv; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 foreach target in array array[j,active_job,retry_job] loop
  packet:=public.get_my_application_disclosure_preview(target,'{}');
  perform public.save_my_application_disclosure(target,'{}',packet->>'source_token');perform public.prepare_my_application(target,false);
 end loop;
 insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,u,'QA_L12_EVIDENCE');
 report:=public.submit_moderation_report('conversation',conv,'privacy','QA L12 evidence retention');
 reset role;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 insert into public.employment_records(match_id,youth_user_id,company_user_id,company_name,role_name,start_date) values(mid,u,c,'QA L12 company','QA role',current_date);
 update public.matches set status='hired',hire_completed_at=stamp where id=mid;
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(j,c,'hired'),(retry_job,c,'no_hire');
 update public.jobs set status='closed',is_active=false where id in(j,retry_job);
 if (select reason from private.application_retention where job_id=j and youth_user_id=u)<>'hired' then raise exception 'Hire did not close application'; end if;
 if exists(select 1 from private.application_retention where job_id=active_job and youth_user_id=u) then raise exception 'Active application closed'; end if;
 -- Pausing is never a terminal application event; closing/reopening a job is.
 update public.jobs set status='paused',is_active=false where id=active_job;
 if exists(select 1 from private.application_retention where job_id=active_job) then raise exception 'Pause closed application'; end if;
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(active_job,c,'continuing');
 update public.jobs set status='closed',is_active=false where id=active_job;
 if not exists(select 1 from private.application_retention where job_id=active_job) then raise exception 'Close not tracked'; end if;
 update public.jobs set status='active',is_active=true where id=active_job;
 if exists(select 1 from private.application_retention where job_id=active_job) then raise exception 'Reopen did not clear only active closure'; end if;
 checks:=array_append(checks,'terminal closure, pause, reopen and independent active application');
 if exists(select 1 from private.data_retention_config where applications_enabled or chats_enabled) or exists(select 1 from cron.job where jobname='mnw-data-retention' and active) then raise exception 'Unsafe default activation'; end if;
 result:=private.process_data_retention(10);if (result->>'enabled')::boolean then raise exception 'Disabled worker did work'; end if;
 begin update private.data_retention_config set applications_enabled=true;raise exception 'Enabled without policy review';exception when check_violation then null;end;
 update private.data_retention_config set policy_reference='QA rollback only',policy_reviewed_at=stamp,legacy_reviewed_at=stamp,applications_enabled=true;
 checks:=array_append(checks,'disabled defaults and mandatory policy/legacy gates');
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(active_job,c,'continuing');
 update public.jobs set status='closed',is_active=false where id=active_job;
 update private.application_retention set closed_at=stamp-interval '6 months',delete_after=stamp where job_id=active_job;
 update public.jobs set status='active',is_active=true where id=active_job;
 if private.application_content_available(active_job,u) then raise exception 'Reopen resurrected expired underlay'; end if;
 -- Restore only this synthetic active control after verifying the cutoff.
 delete from private.application_retention where job_id=active_job;
 checks:=array_append(checks,'reopen after cutoff never resurrects expired body');

 update private.application_retention set closed_at=stamp-interval '6 months',delete_after=stamp+interval '1 microsecond' where job_id=j and youth_user_id=u;
 set local role authenticated;
 if public.get_application_disclosure(j,u) is null or not private.can_read_candidate_cv(cv_path) then raise exception 'Access denied before expiry'; end if;
 reset role;
 update private.application_retention set delete_after=stamp where job_id=j and youth_user_id=u;
 set local role authenticated;
 begin perform public.get_application_disclosure(j,u);raise exception 'Expired disclosure visible';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.get_company_candidates(j)) then raise exception 'Expired candidate visible'; end if;
 -- Same CV remains legitimately shared by the second, active application.
 if public.get_application_disclosure(active_job,u) is null or not private.can_read_candidate_cv(cv_path) then raise exception 'Other application/CV sharing lost'; end if;
 begin perform public.get_candidate_assessment_input(j,u);raise exception 'Expired AI input accessible';exception when insufficient_privilege then null;end;
 begin perform 1 from private.data_retention_config;raise exception 'Client read config';exception when insufficient_privilege then null;end;
 begin perform private.process_data_retention(10);raise exception 'Client ran purge';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.application_completions where job_id=j) then raise exception 'Expired own answers exposed'; end if;
 if not exists(select 1 from public.get_my_application_retention() where job_id=j and expired) then raise exception 'Own expiry summary missing'; end if;
 reset role;
 if private.application_matching_input(j,u) is not null or private.application_analysis_eligible(j,u) then raise exception 'Worker input survives expiry'; end if;
 checks:=array_append(checks,'before/exact expiry, direct RLS, disclosure/candidates/CV/AI and own minimal history');
 insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot)
 values(retry_job,u,c,1,repeat('1',64),'{"policyVersion":"10","disclosureRevision":"1","qa":"history-one"}','[]'),(retry_job,u,c,1,repeat('2',64),'{"policyVersion":"10","disclosureRevision":"1","qa":"history-two"}','[]');
 insert into public.application_followups(youth_user_id,job_id,criterion_key,criterion_label,question,job_profile_version) values(u,retry_job,'qa','QA','QA private question?',1);
 result:=private.process_data_retention(10);
 if (result->>'applications')::int<>1 or (result->>'failures')::int<>0 then raise exception 'Application purge failed: %',result; end if;
 if exists(select 1 from private.application_disclosures where job_id=j and youth_user_id=u) or exists(select 1 from public.application_completions where job_id=j and youth_user_id=u) then raise exception 'Expired body retained'; end if;
 if (select to_jsonb(y) from public.youth_profiles y where user_id=u) is distinct from orig then raise exception 'Current profile/CV changed'; end if;
 if not exists(select 1 from public.matches where id=mid) or not exists(select 1 from public.employment_records where match_id=mid) then raise exception 'Employment was cascaded away'; end if;
 if not exists(select 1 from storage.objects where bucket_id='youth-documents' and name=cv_path) then raise exception 'Shared original CV was removed'; end if;
 if not exists(select 1 from private.application_disclosures where job_id=active_job and youth_user_id=u) then raise exception 'Active application purged'; end if;
 result:=private.process_data_retention(10);if (result->>'applications')::int<>0 then raise exception 'Purge not idempotent'; end if;
 checks:=array_append(checks,'atomic idempotent purge preserves profile, shared CV, active application and employment');
 update private.application_retention set closed_at=stamp-interval '6 months',delete_after=stamp where job_id=retry_job;
 insert into pg_temp.l12_fail_target values(retry_job);
 result:=private.process_data_retention(10);
 if (result->>'failures')::int<>1 then raise exception 'Failure not recorded'; end if;
 if (select count(*) from public.candidate_assessments where job_id=retry_job)<>2 or not exists(select 1 from public.application_followups where job_id=retry_job) or not exists(select 1 from private.application_disclosures where job_id=retry_job) then raise exception 'Partial failed purge committed'; end if;
 delete from pg_temp.l12_fail_target;
 result:=private.process_data_retention(10);
 if (result->>'applications')::int<>1 or exists(select 1 from public.candidate_assessments where job_id=retry_job) or exists(select 1 from public.application_followups where job_id=retry_job) then raise exception 'Retry/historical versions not purged'; end if;
 begin insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot) values(j,u,c,1,repeat('3',64),'{}','[]');raise exception 'Old worker recreated purged assessment';exception when sqlstate 'PT409' then null;end;
 checks:=array_append(checks,'failure rolls whole item back, retry removes all versions and stale work is rejected');
 -- System work and forged message timestamps cannot extend the server clock.
 update private.conversation_retention set last_activity_at=stamp-interval '1 hour',read_only_at=stamp+interval '6 months',delete_after=stamp+interval '12 months' where conversation_id=active_conv;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into public.messages(conversation_id,sender_user_id,message_text) values(active_conv,u,'QA automated work');
 if (select last_activity_at from private.conversation_retention where conversation_id=active_conv)<>stamp-interval '1 hour' then raise exception 'Background work renewed chat'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.messages(conversation_id,sender_user_id,message_text,created_at) values(active_conv,u,'QA real activity',stamp+interval '10 years');
 reset role;
 if (select last_activity_at from private.conversation_retention where conversation_id=active_conv)<>stamp then raise exception 'Client changed activity clock'; end if;
 update private.data_retention_config set chats_enabled=true;
 update private.conversation_retention set last_activity_at=stamp-interval '6 months',read_only_at=stamp,delete_after=stamp+interval '6 months' where conversation_id=conv;
 set local role authenticated;
 begin insert into public.messages(conversation_id,sender_user_id,message_text) values(conv,u,'QA forbidden archive send');raise exception 'Archived chat accepted message';exception when sqlstate 'PT409' then null;end;
 if not exists(select 1 from public.messages where conversation_id=conv) then raise exception 'Archived history hidden too early'; end if;
 reset role;
 checks:=array_append(checks,'real activity only, forged client time ignored and six-month write boundary');
 update private.conversation_retention set read_only_at=stamp-interval '6 months',delete_after=stamp where conversation_id=conv;
 set local role authenticated;
 if exists(select 1 from public.messages where conversation_id=conv) then raise exception 'Expired messages visible before physical purge'; end if;
 if not exists(select 1 from public.get_conversation_retention(conv) where read_only and expired) then raise exception 'Own expired-chat state missing'; end if;
 reset role;
 result:=private.process_data_retention(10);
 if (result->>'conversations')::int<>1 or exists(select 1 from public.messages where conversation_id=conv) then raise exception 'Chat body purge failed: %',result; end if;
 if not exists(select 1 from public.conversations where id=conv) or not exists(select 1 from public.employment_records where match_id=mid) then raise exception 'Chat purge cascaded employment/media metadata'; end if;
 if not exists(select 1 from public.moderation_reports where id=report and target_snapshot::text like '%QA_L12_EVIDENCE%') then raise exception 'Separate report evidence destroyed'; end if;
 result:=private.process_data_retention(10);if (result->>'conversations')::int<>0 then raise exception 'Chat purge not idempotent'; end if;
 checks:=array_append(checks,'twelve-month read boundary, physical text deletion, idempotence and separate evidence preserved');
 perform set_config('request.jwt.claim.sub',outsider::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.get_my_application_retention()) then raise exception 'Other youth read lifecycle'; end if;
 begin perform public.get_conversation_retention(conv);raise exception 'Other youth read chat clock';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub',other_c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other_c,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.get_my_application_retention()) then raise exception 'Wrong company read lifecycle'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 begin perform public.get_my_application_retention();raise exception 'Anonymous read lifecycle';exception when insufficient_privilege then null;end;
 reset role;
 checks:=array_append(checks,'anonymous, other youth/company denied lifecycle and worker access');
 insert into l12_results values(jsonb_build_object('groups',cardinality(checks),'checks',checks,'rollback',true,'physical_files',false));
end $$;
select result from l12_results;
rollback;
