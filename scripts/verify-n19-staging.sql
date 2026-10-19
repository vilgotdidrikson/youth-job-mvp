-- Existing fictitious QA identities only; the entire fixture is rolled back.
begin;
do $$ begin
 if not exists(select 1 from public.youth_profiles where user_id='40416000-07aa-4416-9098-fb4be9928558' and full_name='Alex Testsson') or not exists(select 1 from public.company_profiles where user_id='120c7407-1e8a-488c-9047-f52d79325011' and company_name like 'QA Bistro%') then raise exception 'QA identities changed'; end if;
end $$;
update public.youth_profiles set cv_text='QA N19 ORIGINAL CV. Jag har B-körkort.',cv_generated=true,
 cv_structured='{"profile":{"summary":"QA approved summary","sourceNotes":["PRIVATE_RAW_NOTES"]},"workExperience":[{"role":"QA approved role","sourceNotes":["PRIVATE_NESTED_NOTES"]}],"education":[],"skills":[],"languages":[],"certifications":[],"projects":[],"otherExperience":[]}',
 address='QA Hemgatan 91',documents='[{"type":"cv","name":"QA-original.pdf","url":"40416000-07aa-4416-9098-fb4be9928558/qa-n19-original.pdf"},{"type":"other","name":"Private.pdf","url":"40416000-07aa-4416-9098-fb4be9928558/qa-private.pdf"}]',
 recruitment_profile='{"availability":{"days":["sat","sun"],"periods":["evening"],"startDate":"2026-11-01","hours":"10"},"preferences":{"roles":["PRIVATE_ROLE_PREFERENCE"],"locations":[],"travelMinutes":"","motivation":"PRIVATE_MOTIVATION"},"examples":[{"strength":"responsibility","context":"QA SELECTED EXAMPLE","action":"Jag planerade träningar."},{"strength":"service","context":"PRIVATE_UNSELECTED_EXAMPLE","action":"Jag hjälpte kunder."}],"qualifications":{"licences":["B-körkort"],"tools":[],"languages":[]}}'
 where user_id='40416000-07aa-4416-9098-fb4be9928558';
create temporary table n19_fixture(job uuid,other_job uuid,preview jsonb,packet jsonb);
grant select,update on n19_fixture to authenticated;
grant select on n19_fixture to service_role;
with a as (insert into public.jobs(company_user_id,company_name,title,description,city,address) values('120c7407-1e8a-488c-9047-f52d79325011','QA Bistro – fictional','QA N19 rollback','QA café, kundkontakt','QA','QA Jobbgatan 1') returning id),b as (insert into public.jobs(company_user_id,company_name,title,city,address) values('120c7407-1e8a-488c-9047-f52d79325011','QA Bistro – fictional','QA N19 no application','QA','QA Jobbgatan 2') returning id) insert into n19_fixture(job,other_job) select a.id,b.id from a,b;
insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions) select job,'approved','QA café','[{"label":"B-körkort","required":true}]','[{"id":"q1","question":"När kan du börja?","answer_type":"text"}]' from n19_fixture;
select set_config('request.jwt.claim.sub','40416000-07aa-4416-9098-fb4be9928558',true);
select set_config('request.jwt.claims','{"sub":"40416000-07aa-4416-9098-fb4be9928558","role":"authenticated"}',true);
set local role authenticated;
update n19_fixture set preview=public.get_my_application_disclosure_preview(job,'{}');
do $$ begin
 if public.get_job_requirement_insight((select job from n19_fixture))::text ~ '(weight|score|coverage)' then raise exception 'Youth insight leaked weights/results'; end if;
 if (select jsonb_array_length(preview->'packet'->'profile_items') from n19_fixture)<>0 then raise exception 'Optional profile is shared by default'; end if;
 if (select preview->'packet' from n19_fixture)::text like '%PRIVATE_%' then raise exception 'Preview leaked private data'; end if;
 if (select preview->'packet' from n19_fixture)::text like '%QA Hemgatan%' then raise exception 'Residential address leaked'; end if;
end $$;
select public.save_my_application_disclosure(job,array['example:0'],preview->>'source_token') from n19_fixture;
select public.prepare_my_application(job) from n19_fixture;
update n19_fixture set packet=public.get_application_disclosure(job,auth.uid());
do $$ begin
 if (select packet->'profile_items'->0->>'text' from n19_fixture) not like '%QA SELECTED EXAMPLE%' then raise exception 'Selected example missing'; end if;
 if (select packet from n19_fixture)::text like '%PRIVATE_%' then raise exception 'Private facts leaked in packet'; end if;
 if (select packet->'cv'->'documents' from n19_fixture)::text like '%qa-private%' then raise exception 'Unrelated file shared'; end if;
 begin perform * from private.application_disclosures; raise exception 'Direct private table access permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Seed an old assessment and a current one, without calling any provider.
insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot)
 select job,'40416000-07aa-4416-9098-fb4be9928558','120c7407-1e8a-488c-9047-f52d79325011',1,repeat('a',64),'{"policyVersion":9,"private":"OLD_PRIVATE_RESULT"}','[]' from n19_fixture;
insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot)
 select job,'40416000-07aa-4416-9098-fb4be9928558','120c7407-1e8a-488c-9047-f52d79325011',1,repeat('b',64),jsonb_build_object('policyVersion',10,'disclosureRevision',packet->'revision','criteria','[]'::jsonb),'[]' from n19_fixture;
select set_config('request.jwt.claim.sub','120c7407-1e8a-488c-9047-f52d79325011',true);
select set_config('request.jwt.claims','{"sub":"120c7407-1e8a-488c-9047-f52d79325011","role":"authenticated"}',true);
set local role authenticated;
do $$ declare got jsonb; begin
 select public.get_application_disclosure(job,'40416000-07aa-4416-9098-fb4be9928558') into got from n19_fixture;
 if got is distinct from (select packet from n19_fixture) then raise exception 'Company and youth preview differ'; end if;
 select public.get_candidate_assessment_input(job,'40416000-07aa-4416-9098-fb4be9928558') into got from n19_fixture;
 if public.get_verified_experience('40416000-07aa-4416-9098-fb4be9928558',(select job from n19_fixture))<>'[]'::jsonb then raise exception 'Generic verified history leaked outside selection'; end if;
 if got ? 'recruitment_profile' or got::text like '%PRIVATE_%' then raise exception 'Legacy RPC leaks full profile'; end if;
 if (select count(*) from public.get_company_candidates((select job from n19_fixture)))<>1 then raise exception 'Application with no video/AI hidden'; end if;
 if exists(select 1 from public.youth_profiles where user_id='40416000-07aa-4416-9098-fb4be9928558') then raise exception 'Company reads profile directly'; end if;
 if (select count(*) from public.candidate_assessments where job_id=(select job from n19_fixture))<>1 then raise exception 'Old result still visible'; end if;
 if not private.can_read_candidate_cv('40416000-07aa-4416-9098-fb4be9928558/qa-n19-original.pdf') or private.can_read_candidate_cv('40416000-07aa-4416-9098-fb4be9928558/qa-private.pdf') then raise exception 'File disclosure scope failed'; end if;
 begin perform public.get_application_matching_input((select job from n19_fixture),'40416000-07aa-4416-9098-fb4be9928558',auth.uid()); raise exception 'Rich RPC is company callable'; exception when insufficient_privilege then null; end;
 begin perform public.get_application_disclosure((select other_job from n19_fixture),'40416000-07aa-4416-9098-fb4be9928558'); raise exception 'Wrong application access'; exception when insufficient_privilege then null; end;
 begin perform * from private.application_disclosures; raise exception 'Company reads private table'; exception when insufficient_privilege then null; end;
 begin insert into public.candidate_assessments(job_id) values((select job from n19_fixture)); raise exception 'Company can forge assessment'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{}',true);
-- Profile edits must not silently replace a sent CV or grant the new file.
update public.youth_profiles set cv_text='QA N19 NEW CV',documents='[{"type":"cv","name":"QA-new.pdf","url":"40416000-07aa-4416-9098-fb4be9928558/qa-n19-new.pdf"}]' where user_id='40416000-07aa-4416-9098-fb4be9928558';
select set_config('request.jwt.claim.sub','40416000-07aa-4416-9098-fb4be9928558',true);
select set_config('request.jwt.claims','{"sub":"40416000-07aa-4416-9098-fb4be9928558","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (public.get_application_disclosure((select job from n19_fixture),auth.uid())->'cv'->>'text') not like '%ORIGINAL%' then raise exception 'Profile edit changed shared CV'; end if;
 begin perform public.save_my_application_disclosure((select job from n19_fixture),array['example:0'],(select preview->>'source_token' from n19_fixture)); raise exception 'Stale approval accepted'; exception when serialization_failure then null; end;
end $$;
update n19_fixture set preview=public.get_my_application_disclosure_preview(job,array['example:0']);
select public.save_my_application_disclosure(job,array['example:0'],preview->>'source_token') from n19_fixture;
select public.save_my_application_answers(job,'{"q1":"QA explicitly shared answer"}',false) from n19_fixture;
update n19_fixture set packet=public.get_application_disclosure(job,auth.uid());
do $$ begin
 if (select packet->'cv'->>'text' from n19_fixture)<>'QA N19 NEW CV' then raise exception 'Explicit update did not replace CV'; end if;
 if (select packet->'answers'->>'q1' from n19_fixture)<>'QA explicitly shared answer' then raise exception 'Answer not shared'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','120c7407-1e8a-488c-9047-f52d79325011',true);
select set_config('request.jwt.claims','{"sub":"120c7407-1e8a-488c-9047-f52d79325011","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.candidate_assessments where job_id=(select job from n19_fixture)) then raise exception 'Old disclosure result survived revision change'; end if;
 if private.can_read_candidate_cv('40416000-07aa-4416-9098-fb4be9928558/qa-n19-original.pdf') then raise exception 'Old CV retained after explicit replacement'; end if;
 if not private.can_read_candidate_cv('40416000-07aa-4416-9098-fb4be9928558/qa-n19-new.pdf') then raise exception 'New shared CV not authorized'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','875c6885-ffbb-4a74-99a8-aac3cd194e84',true);
select set_config('request.jwt.claims','{"sub":"875c6885-ffbb-4a74-99a8-aac3cd194e84","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.get_application_disclosure((select job from n19_fixture),'40416000-07aa-4416-9098-fb4be9928558'); raise exception 'Other youth reads disclosure'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare internal jsonb; begin
 select public.get_application_matching_input(job,'40416000-07aa-4416-9098-fb4be9928558','120c7407-1e8a-488c-9047-f52d79325011') into internal from n19_fixture;
 if internal::text not like '%PRIVATE_UNSELECTED_EXAMPLE%' then raise exception 'Internal matching lost approved breadth'; end if;
 if internal::text like '%PRIVATE_NESTED_NOTES%' then raise exception 'Private extraction notes in matching'; end if;
 if private.application_matching_input((select job from n19_fixture),'40416000-07aa-4416-9098-fb4be9928558') is null then raise exception 'Worker lacks private helper permission'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.get_application_disclosure(gen_random_uuid(),gen_random_uuid()); raise exception 'Anon endpoint access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS N19: identical shared packet, selected scope, private notes/files, old RPC, direct table/profile/result denial, immutable CV, stale guard, explicit update/answer, revision and Storage predicate, wrong job/youth/anon; rollback' as result;
rollback;
