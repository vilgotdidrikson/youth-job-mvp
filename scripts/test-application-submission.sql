-- Run only against DevStaging. All fixture changes are rolled back.
begin;
create temporary table application_test_fixture as
select y.user_id, j.id as job_id from public.youth_profiles y cross join public.jobs j
join public.company_profiles c on c.user_id=j.company_user_id
where j.status='active' and j.publication_status='published' and c.verification_status='verified'
and not public.users_are_blocked(y.user_id,j.company_user_id) limit 1;
grant select on application_test_fixture to authenticated;
do $$ begin if not exists(select 1 from application_test_fixture) then raise exception 'No eligible DevStaging fixture'; end if; end; $$;
update public.youth_profiles set cv_text='',cv_generated=false,cv_uploaded=false,documents='[]'
where user_id=(select user_id from application_test_fixture);
delete from public.application_completions where youth_user_id=(select user_id from application_test_fixture) and job_id=(select job_id from application_test_fixture);
insert into public.application_completions(youth_user_id,job_id,job_title,company_name,profile_version,questions,status)
select user_id,job_id,'Transactional test','Test',1,'[{"id":"q1","question":"Tillgänglighet?"}]','needs_completion' from application_test_fixture;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from application_test_fixture),'role','authenticated')::text,true);
do $$ declare job uuid:=(select job_id from application_test_fixture); begin
  perform public.save_my_application_answers(job,'{"q1":"Sparat svar"}',false);
  begin perform public.save_my_application_answers(job,'{}',true); raise exception 'Missing CV accepted'; exception when insufficient_privilege then null; end;
  begin perform public.apply_my_application_evidence(job,'{"q1":"AI svar"}',repeat('a',64)); raise exception 'AI bypassed CV check'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
update public.youth_profiles set cv_text='Transactional test CV' where user_id=(select user_id from application_test_fixture);
update public.jobs set status='paused' where id=(select job_id from application_test_fixture);
set local role authenticated;
do $$ declare job uuid:=(select job_id from application_test_fixture); a jsonb; begin
  a:=public.save_my_application_answers(job,'{"q1":"Sparat under paus"}',false);
  if a#>>'{answers,q1}'<>'Sparat under paus' then raise exception 'Paused draft save failed'; end if;
  begin perform public.save_my_application_answers(job,'{}',true); raise exception 'Paused submission accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
update public.jobs set status='active' where id=(select job_id from application_test_fixture);
set local role authenticated;
do $$ declare job uuid:=(select job_id from application_test_fixture); a jsonb; begin
  a:=public.save_my_application_answers(job,'{}',true);
  if a->>'status'<>'submitted' or a#>>'{answers,q1}'<>'Sparat under paus' then raise exception 'Resume submission failed'; end if;
  a:=public.save_my_application_answers(job,'{"q1":"Changed"}',true);
  if a#>>'{answers,q1}'<>'Sparat under paus' then raise exception 'Submitted snapshot changed'; end if;
end; $$;
reset role;
select 'PASS: manual/AI submission requires CV; pause saves but blocks send; resumed send preserves answers; retries are immutable.' as checks;
rollback;
