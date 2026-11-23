-- Run with the company agreement migration inside a rollback transaction.
do $$
declare
  company uuid := gen_random_uuid();
  other_company uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  youth uuid := gen_random_uuid();
  vacancy uuid := gen_random_uuid();
  second_vacancy uuid := gen_random_uuid();
  document jsonb;
  receipt jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    (company,'qa-agreement-'||company||'@example.invalid',null,'{"role":"company"}'),
    (other_company,'qa-agreement-'||other_company||'@example.invalid',now(),'{"role":"company"}'),
    (admin,'qa-agreement-'||admin||'@example.invalid',now(),'{"role":"private"}'),
    (youth,'qa-agreement-'||youth||'@example.invalid',now(),'{"role":"youth"}');
  insert into public.admin_users(user_id) values (admin);
  update public.youth_profiles set cv_generated=true,cv_text='Fiktivt CV' where user_id=youth;
  perform set_config('request.jwt.claim.sub',company::text,true);
  update public.company_profiles set organization_number='556016-0680',company_name='QA Fiktivt företag' where user_id=company;
  insert into public.jobs(id,company_user_id,company_name,title,description,address)
    values (vacancy,company,'QA Fiktivt företag','QA jobb','Fiktiv annons','QA Testvägen 1');
  if public.get_my_company_agreement() is not null then raise exception 'No version must mean no active agreement'; end if;
  insert into private.company_agreement_versions values
    ('qa-v1','Testavtal ett','Testbilaga ett',now()-interval '2 minutes');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',company::text,true);
  document:=public.get_my_company_agreement();
  if document->>'version' is distinct from 'qa-v1' or document->>'annex' is distinct from 'Testbilaga ett' then
    raise exception 'Current document could not be read';
  end if;
  begin
    perform public.accept_my_company_agreement('qa-v1','Testperson','Företrädare',true,true);
    raise exception 'Unconfirmed email was accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  begin
    perform public.review_company_verification(company,'verified',null);
    raise exception 'Company became verified before accepting';
  exception when insufficient_privilege then null; end;
  reset role;
  update auth.users set email_confirmed_at=now() where id=company;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',company::text,true);
  begin
    perform public.accept_my_company_agreement('qa-v1','Testperson','Företrädare',true,false);
    raise exception 'Missing authority confirmation accepted';
  exception when invalid_parameter_value then null; end;
  receipt:=public.accept_my_company_agreement('qa-v1','Testperson','Företrädare',true,true);
  if receipt->>'acceptedAt' is null or receipt->>'acceptedOrganizationNumber' is distinct from '5560160680' then
    raise exception 'Agreement acceptance missing identity';
  end if;
  if receipt is distinct from public.accept_my_company_agreement('qa-v1','Annat namn','Annan roll',true,true) then
    raise exception 'Retry changed the receipt';
  end if;
  if public.is_verified_company(company) then raise exception 'Acceptance verified the company'; end if;
  begin
    perform public.get_pending_company_agreements();
    raise exception 'Company could read the admin agreement queue';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  if public.get_pending_company_agreements() #>> '{receipts,0,representative}' is distinct from 'Testperson' then
    raise exception 'Admin cannot check the accepted representative';
  end if;
  perform public.review_company_verification(company,'verified',null);
  if not public.is_verified_company(company) then raise exception 'Admin decision denied after acceptance'; end if;

  reset role;
  insert into private.company_agreement_versions values
    ('qa-v2','Testavtal två','Testbilaga två',now()-interval '1 minute'),
    ('qa-v3','Framtida avtal','Framtida bilaga',now()+interval '1 minute');
  begin
    update private.company_agreement_versions set agreement_text='Ändrat' where version='qa-v1';
    raise exception 'Published text was overwritten';
  exception when check_violation then null; end;
  set local role authenticated;
  if public.is_verified_company(company) then raise exception 'Old version still unlocks recruitment'; end if;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if exists(select 1 from public.jobs where id=vacancy) then raise exception 'Unaccepted version still visible'; end if;
  begin
    perform public.prepare_my_application(vacancy);
    raise exception 'Direct submission bypassed agreement';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',other_company::text,true);
  if public.get_my_company_agreement('qa-v1') is not null then raise exception 'Another company reads the old receipt'; end if;
  perform set_config('request.jwt.claim.sub',company::text,true);
  if public.get_my_company_agreement()->>'version' is distinct from 'qa-v2' then raise exception 'Wrong effective version'; end if;
  if public.get_my_company_agreement('qa-v1')->>'agreement' is distinct from 'Testavtal ett' then raise exception 'Old receipt was lost'; end if;
  begin
    perform public.accept_my_company_agreement('qa-v1','Testperson','Företrädare',true,true);
    raise exception 'Stale confirmation accepted';
  exception when serialization_failure then null; end;
  perform public.accept_my_company_agreement('qa-v2','Testperson','Företrädare',true,true);
  if not public.is_verified_company(company) then raise exception 'Renewal did not restore eligibility'; end if;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  begin
    perform public.prepare_my_application(vacancy);
    raise exception 'Application was accepted without recruitment privacy information';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',company::text,true);
  begin
    perform public.save_my_company_recruitment_notice('privacy@example.invalid','javascript:alert(1)',null);
    raise exception 'Unsafe link accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_my_company_recruitment_notice('privacy@example.invalid',null,'{"purpose":"Only one field"}');
    raise exception 'Incomplete template accepted';
  exception when invalid_parameter_value then null; end;
  perform public.save_my_company_recruitment_notice('privacy@example.invalid','https://example.invalid/recruitment',null);
  perform set_config('request.jwt.claim.sub',other_company::text,true);
  if public.get_my_company_recruitment_notice() is not null then raise exception 'Foreign company notice leaked through owner RPC'; end if;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if public.get_job_recruitment_notice(vacancy)->>'link' is distinct from 'https://example.invalid/recruitment' then
    raise exception 'Applicant cannot see recruitment privacy information';
  end if;
  perform set_config('request.jwt.claim.sub',company::text,true);
  perform public.save_my_company_recruitment_notice('privacy@example.invalid',null,
    '{"purpose":"QA ändamål","basis":"QA grund","recipients":"QA mottagare","transfers":"QA överföring","retention":"QA lagring","rights":"QA rättigheter"}');
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if public.get_job_recruitment_notice(vacancy) #>> '{details,rights}' is distinct from 'QA rättigheter' then
    raise exception 'Applicant cannot see the filled-in template';
  end if;
  if public.prepare_my_application(vacancy)->>'status' is distinct from 'submitted' then raise exception 'Normal submission failed'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub',company::text,true);
  insert into public.jobs(id,company_user_id,company_name,title,description,address)
    values (second_vacancy,company,'QA Fiktivt företag','QA andra jobbet','Fiktiv annons','QA Testvägen 1');
  insert into private.youth_terms_versions values ('qa-y1','Fiktiva ungdomsvillkor',now()-interval '1 minute');
  set local role authenticated;
  begin
    perform public.accept_my_youth_terms('qa-y1',true);
    raise exception 'Company accepted youth terms';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if public.get_my_youth_terms()->>'terms' is distinct from 'Fiktiva ungdomsvillkor' then raise exception 'Youth could not read terms'; end if;
  begin
    perform public.prepare_my_application(second_vacancy);
    raise exception 'Direct submission bypassed youth terms';
  exception when insufficient_privilege then null; end;
  begin
    perform public.accept_my_youth_terms('qa-y1',false);
    raise exception 'Terms accepted without an explicit choice';
  exception when invalid_parameter_value then null; end;
  receipt:=public.accept_my_youth_terms('qa-y1',true);
  if receipt->>'acceptedAt' is null or receipt is distinct from public.accept_my_youth_terms('qa-y1',true) then
    raise exception 'Youth receipt is missing or changed on retry';
  end if;
  if public.prepare_my_application(second_vacancy)->>'status' is distinct from 'submitted' then raise exception 'Submission after accepting youth terms failed'; end if;
  if public.my_application_ai_status(second_vacancy) then raise exception 'Youth agreement implicitly allowed AI'; end if;
  reset role;
  update private.company_agreement_acceptances set ended_at=now() where company_user_id=company and version='qa-v2';
  if public.is_verified_company(company) then raise exception 'Ended agreement still grants access'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',company::text,true);
  begin
    perform public.get_application_disclosure(vacancy,youth);
    raise exception 'Ended agreement still grants candidate access';
  exception when insufficient_privilege then null; end;
  reset role;
  delete from auth.users where id=company;
  if (select count(*) from private.closed_company_agreement_receipts where former_company_user_id=company)<>2
    or exists(select 1 from private.company_recruitment_notices where company_user_id=company)
    or exists(select 1 from private.company_agreement_acceptances where company_user_id=company) then
    raise exception 'Account closure did not archive only the expected receipts';
  end if;
  if not exists(select 1 from private.closed_company_agreement_receipts r
    join private.company_agreement_versions v using(version)
    where r.former_company_user_id=company and r.version='qa-v1' and v.annex_text='Testbilaga ett') then
    raise exception 'Original annex was lost on account closure';
  end if;
  begin
    perform private.purge_closed_company_agreements(now());
    raise exception 'Early purge was allowed';
  exception when invalid_parameter_value then null; end;
  if has_table_privilege('authenticated','private.closed_company_agreement_receipts','select')
    or has_function_privilege('authenticated','private.purge_closed_company_agreements(timestamptz,integer)','execute') then
    raise exception 'Archive or purge permissions too broad';
  end if;
end $$;
