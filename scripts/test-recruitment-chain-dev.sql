-- DevStaging only. The fixture, notifications and messages roll back together.
begin;
create temp table chain_checks(label text primary key);
grant insert,select on chain_checks to authenticated;

create function pg_temp.check_chain(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'L07: %', label; end if;
  insert into chain_checks values (label);
end $$;

create function pg_temp.chain_actor(actor uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated')::text, true);
end $$;

do $$
declare
  company uuid := gen_random_uuid();
  youth uuid := gen_random_uuid();
  other_youth uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  preview jsonb;
  disclosure jsonb;
  chat uuid;
  application_question uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (company,'qa-l07-'||company||'@example.invalid','{"role":"company"}'),
    (youth,'qa-l07-'||youth||'@example.invalid','{"role":"youth"}'),
    (other_youth,'qa-l07-'||other_youth||'@example.invalid','{"role":"youth"}'),
    (admin,'qa-l07-'||admin||'@example.invalid','{"role":"private"}');
  insert into public.admin_users(user_id) values (admin);
  update public.youth_profiles set full_name='QA Fiktiv ungdom', city='Stockholm' where user_id=youth;
  perform pg_temp.chain_actor(company);
  update public.company_profiles set organization_number='556016-0680', company_name='QA Testföretag' where user_id=company;
  insert into public.jobs(id,company_user_id,company_name,title,description,address)
    values(job,company,'QA Testföretag','QA ej riktigt jobb','Fiktiva uppgifter','QA Testvägen 1');
  insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions)
    values(job,'approved','QA roll','[]','[]');

  set local role authenticated;
  perform pg_temp.chain_actor(youth);
  perform pg_temp.check_chain('Unverified vacancy is hidden', not exists(select 1 from public.jobs where id=job));
  perform pg_temp.chain_actor(company);
  begin
    perform public.review_company_verification(company,'verified',null);
    raise exception 'L07: employer verified itself';
  exception when insufficient_privilege then null; end;
  perform pg_temp.chain_actor(admin);
  perform public.review_company_verification(company,'verified',null);
  perform pg_temp.chain_actor(youth);
  perform pg_temp.check_chain('Admin approval makes the vacancy visible', exists(select 1 from public.jobs where id=job));

  reset role;
  update public.youth_profiles set cv_generated=true,cv_text='QA CV med erfarenhet från fiktiv praktik' where user_id=youth;
  set local role authenticated;
  perform pg_temp.chain_actor(youth);
  preview:=public.get_my_application_disclosure_preview(job,'{}');
  perform pg_temp.check_chain('Own application preview has a source version', preview->>'source_token' is not null);
  perform public.save_my_application_disclosure(job,'{}',preview->>'source_token');
  perform public.prepare_my_application(job,false);
  perform pg_temp.check_chain('Application is submitted without extra questions',
    exists(select 1 from public.application_completions where job_id=job and youth_user_id=youth and status='submitted'));

  perform pg_temp.chain_actor(other_youth);
  perform pg_temp.check_chain('Other applicants cannot read the application',
    not exists(select 1 from public.application_completions where job_id=job));
  perform pg_temp.chain_actor(company);
  disclosure:=public.get_application_disclosure(job,youth);
  perform pg_temp.check_chain('Employer receives the disclosed CV',disclosure::text like '%QA CV med erfarenhet från fiktiv praktik%');
  application_question:=(public.create_company_application_question(job,youth,'Vilka uppgifter gjorde du under praktiken?',gen_random_uuid())->>'id')::uuid;
  perform pg_temp.chain_actor(youth);
  perform public.save_my_application_supplement(job,'{}','{}',jsonb_build_object(application_question::text,'Jag fyllde på varor.'),'{}');
  perform pg_temp.chain_actor(company);
  perform pg_temp.check_chain('Employer sees the submitted answer',
    (select answer='Jag fyllde på varor.' from public.application_followups where id=application_question));
  perform public.review_candidate_and_match(job,youth,'interested');
  select id into chat from public.conversations where job_id=job and youth_user_id=youth;
  perform pg_temp.check_chain('Candidate review creates one chat',chat is not null);
  insert into public.messages(conversation_id,sender_user_id,message_text) values(chat,company,'QA provmeddelande');
  perform pg_temp.chain_actor(youth);
  perform pg_temp.check_chain('Youth can read the matched company message',
    exists(select 1 from public.messages where conversation_id=chat and message_text='QA provmeddelande'));
  perform pg_temp.chain_actor(other_youth);
  perform pg_temp.check_chain('Unrelated account cannot read messages',
    not exists(select 1 from public.messages where conversation_id=chat));
  perform pg_temp.chain_actor(company);
  update public.jobs set status='paused' where id=job;
  perform pg_temp.check_chain('Owner can pause their ad', exists(select 1 from public.jobs where id=job and status='paused'));
  update public.jobs set status='active', title='QA uppdaterat testjobb' where id=job;
  perform pg_temp.chain_actor(youth);
  perform pg_temp.check_chain('Edited and republished job is visible',
    exists(select 1 from public.jobs where id=job and status='active' and title='QA uppdaterat testjobb'));
end $$;

reset role;
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label order by label)) as l07 from chain_checks;
rollback;
