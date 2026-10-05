-- Run against DEV only. All synthetic accounts, questions and notifications roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001','followup-youth-a@example.invalid','{"role":"youth"}'),
 ('a1000000-0000-4000-8000-000000000002','followup-youth-b@example.invalid','{"role":"youth"}'),
 ('a1000000-0000-4000-8000-000000000003','followup-company-a@example.invalid','{"role":"company"}'),
 ('a1000000-0000-4000-8000-000000000004','followup-company-b@example.invalid','{"role":"company"}');
insert into public.profiles(id,role) values
 ('a1000000-0000-4000-8000-000000000001','youth'),('a1000000-0000-4000-8000-000000000002','youth'),
 ('a1000000-0000-4000-8000-000000000003','company'),('a1000000-0000-4000-8000-000000000004','company') on conflict(id) do update set role=excluded.role;
insert into public.youth_profiles(user_id,cv_text,cv_generated) values
 ('a1000000-0000-4000-8000-000000000001','Jag har arbetat i butik.',true),('a1000000-0000-4000-8000-000000000002','Jag har arbetat i butik.',true)
 on conflict(user_id) do update set cv_text=excluded.cv_text,cv_generated=true;
insert into public.admin_users(user_id) values ('a1000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
insert into public.company_profiles(user_id,company_name,verification_status) values
 ('a1000000-0000-4000-8000-000000000003','Synthetic A','verified'),('a1000000-0000-4000-8000-000000000004','Synthetic B','verified')
 on conflict(user_id) do update set verification_status='verified';
insert into public.jobs(id,company_user_id,title,company_name) values
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','Synthetic followup job','Synthetic A');
insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria) values
 ('a2000000-0000-4000-8000-000000000001','approved','Butiksarbete','[{"label":"Kan arbeta helger","category":"must_have","required":true},{"label":"Erfarenhet av kassa","category":"merit"},{"label":"Social","category":"trait"}]');
insert into public.swipe_actions(youth_user_id,job_id,decision) values
 ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','interested');
insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,status,submitted_at) values
 ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Synthetic followup job','Synthetic A',1,'submitted',now());
delete from public.admin_users where user_id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $$ declare result jsonb; q uuid; stamp timestamptz; begin
 stamp:=(public.get_my_application_followup_input('a2000000-0000-4000-8000-000000000001')->>'source_updated_at')::timestamptz;
 result:=public.queue_application_followups('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'["Kan arbeta helger"]',repeat('a',64),stamp-interval '1 second');
 if result->>'reason'<>'source_changed' or (select count(*) from public.application_followups)<>0 then raise exception 'Stale analysis queued a question: %',result; end if;
 result:=public.claim_application_followup_analysis('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',repeat('a',64));
 if result->>'claimed'<>'true' then raise exception 'First analysis not claimed'; end if;
 result:=public.claim_application_followup_analysis('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',repeat('b',64));
 if result->>'reason'<>'busy' then raise exception 'Concurrent analysis allowed'; end if;
 perform public.release_application_followup_analysis('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',repeat('b',64));
 if (select followup_pending_hash from public.application_completions where job_id='a2000000-0000-4000-8000-000000000001')<>repeat('a',64) then raise exception 'Different request released lease'; end if;
 perform public.release_application_followup_analysis('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',repeat('a',64));
 if (select followup_pending_hash from public.application_completions where job_id='a2000000-0000-4000-8000-000000000001') is not null then raise exception 'Lease not released'; end if;
 result:=public.queue_application_followups('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'["Kan arbeta helger","Erfarenhet av kassa"]',repeat('a',64));
 if (result->>'queued')::int<>2 then raise exception 'Expected two questions: %',result; end if;
 result:=public.queue_application_followups('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'["Kan arbeta helger"]',repeat('a',64));
 if (result->>'queued')::int<>0 then raise exception 'Duplicate question'; end if;
 result:=public.claim_application_followup_analysis('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',repeat('a',64));
 if result->>'reason'<>'cached' then raise exception 'Cached analysis called again'; end if;
 begin
  perform public.queue_application_followups('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'["Social"]',repeat('a',64));
  raise exception 'Trait accepted';
 exception when invalid_parameter_value then null; end;
 select id into q from public.application_followups where criterion_label='Kan arbeta helger';
 result:=public.save_my_application_followup_answers('a2000000-0000-4000-8000-000000000001',jsonb_build_object(q::text,'Jag kan arbeta varje lördag och söndag.'),'{}');
 if (result->>'updated')::int<>1 then raise exception 'Answer not saved'; end if;
 if (select status from public.application_completions where job_id='a2000000-0000-4000-8000-000000000001')<>'submitted' then raise exception 'Original application altered'; end if;
 if jsonb_array_length(public.get_my_application_followup_input('a2000000-0000-4000-8000-000000000001')->'profile'->'followup_answers')<>1 then raise exception 'Own answer missing'; end if;
 result:=public.save_my_application_followup_answers('a2000000-0000-4000-8000-000000000001',jsonb_build_object(q::text,'Jag kan arbeta varje lördag och söndag.'),'{}');
 if (result->>'updated')::int<>0 then raise exception 'Repeated answer should be idempotent'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.application_followups)<>0 then raise exception 'Other youth read answers'; end if;
 begin
  perform public.save_my_application_followup_answers('a2000000-0000-4000-8000-000000000001','{}','{}');
  raise exception 'Other youth wrote answers';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
do $$ begin
 if (select count(*) from public.application_followups)<>0 then raise exception 'Other company read answers'; end if;
 begin
  perform public.queue_application_followups('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'[]',repeat('a',64));
  raise exception 'Other company queued questions';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
do $$ declare result jsonb; begin
 if (select count(*) from public.application_followups)<>2 then raise exception 'Owner cannot read questions'; end if;
 result:=public.get_candidate_assessment_input('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001');
 if jsonb_array_length(result->'followup_answers')<>1 then raise exception 'Employer answer missing'; end if;
 if result->'followup_answers'->0->>'answer'<>'Jag kan arbeta varje lördag och söndag.' then raise exception 'Answer changed'; end if;
 begin
  perform public.save_my_application_followup_answers('a2000000-0000-4000-8000-000000000001','{}','{}');
  raise exception 'Employer edited youth answer';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.application_followups; raise exception 'Anonymous read answers'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: source snapshot and concurrency guards, question deduplication, trait exclusion, sent application preservation, answer publishing and youth/company/anonymous isolation' as result;
rollback;
