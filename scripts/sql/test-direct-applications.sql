-- DEV only. New synthetic users/job; existing verified test company is not changed.
-- Everything rolls back, with no administrator grants or verification changes.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('d6100000-0000-4000-8000-000000000001','direct-youth-a@example.invalid','{"role":"youth"}'),
 ('d6100000-0000-4000-8000-000000000002','direct-youth-b@example.invalid','{"role":"youth"}');
insert into public.profiles(id,role) values ('d6100000-0000-4000-8000-000000000001','youth'),('d6100000-0000-4000-8000-000000000002','youth') on conflict(id) do nothing;
insert into public.youth_profiles(user_id,cv_text,cv_generated) values
 ('d6100000-0000-4000-8000-000000000001','Jag har hjälpt till i butik.',true),('d6100000-0000-4000-8000-000000000002','',false)
 on conflict(user_id) do update set cv_text=excluded.cv_text,cv_generated=excluded.cv_generated;
select set_config('request.jwt.claim.sub','9007341c-ae4b-4659-90e5-090bec6d4d32',true);
-- Respect the free-tier active-job limit. This synthetic announcement's state
-- is restored by the same final rollback; no committed fixture is changed.
update public.jobs set status='paused',is_active=false where id='2c6902d4-97f8-4544-b04b-a0a1a920260f' and company_user_id='9007341c-ae4b-4659-90e5-090bec6d4d32';
insert into public.jobs(id,company_user_id,title,company_name) values ('d6200000-0000-4000-8000-000000000001','9007341c-ae4b-4659-90e5-090bec6d4d32','Direct application synthetic test','Test company');
insert into public.job_match_profiles(job_id,status,role_summary,candidate_questions,weighted_criteria) values
 ('d6200000-0000-4000-8000-000000000001','approved','Butiksarbete','[{"id":"q1","question":"Vad vill du lära dig?"}]','[{"label":"Kan arbeta helger","category":"must_have","required":true},{"label":"Erfarenhet av kassa","category":"merit"},{"label":"Truckkort","category":"merit"}]');
set local role authenticated;
select set_config('request.jwt.claim.sub','d6100000-0000-4000-8000-000000000001',true);
do $$ declare a jsonb; result jsonb; f uuid; stamp timestamptz; begin
 a:=public.prepare_my_application('d6200000-0000-4000-8000-000000000001');
 if a->>'status'<>'submitted' or a->>'submitted_at' is null then raise exception 'Missing question blocked submission'; end if;
 if not exists(select 1 from public.swipe_actions where job_id='d6200000-0000-4000-8000-000000000001' and decision='interested') then raise exception 'Employer interest not created'; end if;
 if exists(select 1 from public.youth_application_drafts where job_id='d6200000-0000-4000-8000-000000000001') then raise exception 'Sent application retained a draft'; end if;
 perform public.prepare_my_application('d6200000-0000-4000-8000-000000000001');
 if (select count(*) from public.notifications where href='/applications?job=d6200000-0000-4000-8000-000000000001')<>1 then raise exception 'Repeated swipe duplicated notification'; end if;
 stamp:=(public.get_my_application_followup_input('d6200000-0000-4000-8000-000000000001')->>'source_updated_at')::timestamptz;
 result:=public.apply_my_application_evidence_snapshot('d6200000-0000-4000-8000-000000000001','{"q1":"Stale quote"}',repeat('a',64),stamp-interval '1 second');
 if result->>'stale'<>'true' then raise exception 'Stale CV evidence was accepted'; end if;
 result:=public.queue_application_followups('d6200000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001',1,'["Kan arbeta helger","Erfarenhet av kassa","Truckkort"]',repeat('a',64),stamp);
 if (result->>'queued')::integer<>2 then raise exception 'Combined question batch exceeded three: %',result; end if;
 select id into f from public.application_followups where criterion_label='Kan arbeta helger';
 perform public.save_my_application_supplement('d6200000-0000-4000-8000-000000000001','{}',array['q1'],jsonb_build_object(f::text,'Jag kan arbeta helger.'),'{}');
 if (select status from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001')<>'submitted' then raise exception 'Answer changed submitted status'; end if;
 if not (select 'q1'=any(omitted_question_ids) from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001') then raise exception 'Static omission not recorded'; end if;
 result:=public.queue_application_followups('d6200000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001',1,'["Truckkort"]',repeat('b',64));
 if result->>'reason'<>'batch_complete' then raise exception 'Answer triggered another question batch: %',result; end if;
 perform public.save_my_application_supplement('d6200000-0000-4000-8000-000000000001','{"q1":"Jag vill lära mig produktkunskap."}','{}','{}','{}');
 if (select cardinality(omitted_question_ids) from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001')<>0 then raise exception 'Late static answer did not replace omission'; end if;
 begin
  perform public.save_my_application_supplement('d6200000-0000-4000-8000-000000000001','{"q1":"Must roll back"}','{}','{"ffffffff-ffff-4fff-8fff-ffffffffffff":"Not mine"}','{}');
  raise exception 'Unknown followup allowed';
 exception when insufficient_privilege then null; end;
 if (select answers->>'q1' from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001')<>'Jag vill lära mig produktkunskap.' then raise exception 'Partial answer was committed'; end if;
end $$;
select set_config('request.jwt.claim.sub','d6100000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001') then raise exception 'Other youth read answers'; end if;
 begin
  perform public.save_my_application_supplement('d6200000-0000-4000-8000-000000000001','{}','{}','{}','{}');
  raise exception 'Other youth edited application';
 exception when insufficient_privilege then null; end;
 begin
  perform public.prepare_my_application('d6200000-0000-4000-8000-000000000001');
  raise exception 'Missing CV allowed submission';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','9007341c-ae4b-4659-90e5-090bec6d4d32',true);
do $$ begin
 if (select count(*) from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001')<>1 then raise exception 'Owner cannot see submitted application'; end if;
 begin
  perform public.save_my_application_supplement('d6200000-0000-4000-8000-000000000001','{}','{}','{}','{}');
  raise exception 'Company edited youth answers';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.youth_application_drafts(youth_user_id,job_id) values ('d6100000-0000-4000-8000-000000000002','d6200000-0000-4000-8000-000000000001');
update public.youth_profiles set cv_text='Jag har ett färdigt CV.',cv_generated=true where user_id='d6100000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','d6100000-0000-4000-8000-000000000002',true);
do $$ declare result record; begin
 select * into result from public.submit_my_application_drafts();
 if result.sent_count<>1 or result.pending_count<>0 then raise exception 'CV completion still blocked on questions'; end if;
 if (select status from public.application_completions where job_id='d6200000-0000-4000-8000-000000000001')<>'submitted' then raise exception 'Saved interest not sent'; end if;
end $$;
reset role;
update public.jobs set status='paused',is_active=false where id='d6200000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 begin
  perform public.prepare_my_application('d6200000-0000-4000-8000-000000000001');
  raise exception 'Paused listing accepted application';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin
  perform public.prepare_my_application('d6200000-0000-4000-8000-000000000001');
  raise exception 'Anonymous submission allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
