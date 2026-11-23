-- Run with the F20 and per-application migrations inside one rollback transaction.
do $$
declare
  company uuid := gen_random_uuid();
  youth uuid := gen_random_uuid();
  other_youth uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  standard_job uuid := gen_random_uuid();
  ai_job uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (company,'qa-l15-'||company||'@example.invalid','{"role":"company"}'),
    (youth,'qa-l15-'||youth||'@example.invalid','{"role":"youth"}'),
    (other_youth,'qa-l15-'||other_youth||'@example.invalid','{"role":"youth"}'),
    (admin,'qa-l15-'||admin||'@example.invalid','{"role":"private"}');
  insert into public.admin_users(user_id) values (admin);
  perform set_config('request.jwt.claim.sub',company::text,true);
  update public.company_profiles set organization_number='556016-0680',company_name='QA Testföretag' where user_id=company;
  insert into public.jobs(id,company_user_id,company_name,title,description,address)
    values(standard_job,company,'QA Testföretag','QA ordinarie','Fiktiva uppgifter','QA Testvägen 1'),
          (ai_job,company,'QA Testföretag','QA frivillig','Fiktiva uppgifter','QA Testvägen 1');
  insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions)
    values (standard_job,'approved','QA roll','[]','[]'), (ai_job,'approved','QA roll','[]','[]');
  update public.youth_profiles set cv_generated=true,cv_text='QA fiktiv praktik' where user_id=youth;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  perform public.my_application_ai_preference(true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  perform public.review_company_verification(company,'verified',null);
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if public.prepare_my_application(standard_job)->>'status' is distinct from 'submitted' then raise exception 'Standard application failed'; end if;
  if public.my_application_ai_status(standard_job) then raise exception 'Old preference granted permission'; end if;
  perform public.submit_my_application_with_ai(standard_job);
  if public.my_application_ai_status(standard_job) then raise exception 'Retry added consent retroactively'; end if;
  if public.submit_my_application_with_ai(ai_job)->>'status' is distinct from 'submitted' then raise exception 'Application with AI failed'; end if;
  if not public.my_application_ai_status(ai_job) then raise exception 'Explicit permission was not recorded'; end if;
  perform set_config('request.jwt.claim.sub',other_youth::text,true);
  if public.my_application_ai_status(ai_job) then raise exception 'Another account could read permission'; end if;
  perform public.withdraw_my_application_ai(ai_job);
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if not public.my_application_ai_status(ai_job) then raise exception 'Another account revoked permission'; end if;
  perform public.withdraw_my_application_ai(ai_job);
  perform public.submit_my_application_with_ai(ai_job);
  if public.my_application_ai_status(ai_job) then raise exception 'Retry restored revoked permission'; end if;
  if (select count(*) from public.application_completions where youth_user_id=youth and status='submitted') <> 2 then
    raise exception 'AI withdrawal changed ordinary application status';
  end if;
  if has_table_privilege('authenticated','private.application_ai_choices','select')
      or has_function_privilege('authenticated','public.my_application_ai_preference(boolean)','execute') then
    raise exception 'Application AI permissions are too broad';
  end if;
  reset role;
end $$;
