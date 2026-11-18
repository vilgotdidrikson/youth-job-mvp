-- DevStaging only. Fictional accounts, invoices, and notifications roll back together.
begin;
create function pg_temp.invoice_actor(actor uuid, assurance text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated', 'aal', assurance)::text, true);
end;
$$;

do $$
declare
  c uuid := gen_random_uuid(); other_c uuid := gen_random_uuid(); y uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  j uuid := gen_random_uuid(); other_job uuid := gen_random_uuid();
  m uuid := gen_random_uuid(); old_free uuid := gen_random_uuid(); regular uuid := gen_random_uuid();
  paid_invoice uuid; held_invoice uuid; bill jsonb; invoices jsonb; mail_job jsonb; lease uuid;
  billing jsonb := '{"invoice_email":"billing@example.invalid","address_line1":"Ursprunglig testadress 1","address_line2":"","postal_code":"12345","city":"Teststad","reference":""}';
  registration jsonb := jsonb_build_object('role_name', 'Testtjänst', 'start_date', current_date::text, 'expected_employment', null);
  approval jsonb := jsonb_build_object('response', 'approved', 'expected_employment', jsonb_build_object('role_name', 'Testtjänst', 'start_date', current_date::text, 'response', 'pending'));
begin
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
    (c,'qa-invoice-'||c||'@example.invalid','{"role":"company"}','{"hire_invoice_test":true}'),
    (other_c,'qa-invoice-'||other_c||'@example.invalid','{"role":"company","hire_invoice_test":true}','{}'),
    (y,'qa-invoice-'||y||'@example.invalid','{"role":"youth"}','{}'),
    (a,'qa-invoice-'||a||'@example.invalid','{"role":"private"}','{}');
  insert into public.admin_users(user_id) values(a);
  perform pg_temp.invoice_actor(a);
  update public.company_profiles set company_name='Testföretaget AB',verification_status='verified' where user_id in(c,other_c);
  insert into public.jobs(id,company_user_id,company_name,title,description,address) values
    (j,c,'Testföretaget AB','Testjobb','Fiktiv annons','Testgatan 1'),
    (other_job,other_c,'Annat testbolag','Testjobb','Fiktiv annons','Testgatan 2');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values (m,y,c,j,'matched'),(regular,y,other_c,other_job,'matched');
  insert into public.jobs(id,company_user_id,company_name,title,description,address)
    values (old_free,c,'Testföretaget AB','Andra testjobbet','Fiktiv annons','Testgatan 1');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values (old_free,y,c,old_free,'matched');
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
    select id,youth_user_id,company_user_id,job_id from public.matches mm
    where id in (m,old_free,regular) and not exists (select 1 from public.conversations where match_id=mm.id);

  set local role authenticated;
  perform pg_temp.invoice_actor(c);
  if public.hire_invoice_test_offer() is distinct from 'test-launch-500-sek-v1' then raise exception 'Enrolled company has no terms'; end if;
  begin perform public.recruitment_action('register',m,registration); raise exception 'Registration without test consent'; exception when invalid_parameter_value then null; end;
  registration := registration||jsonb_build_object('test_invoice_terms','test-launch-500-sek-v1');
  begin perform public.recruitment_action('register',m,registration); raise exception 'Registration without billing details'; exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.employment_records where match_id=m) then raise exception 'Rejected registration created hire'; end if;
  perform public.save_company_billing_details(c,null,billing);
  perform public.recruitment_action('register',m,registration);
  perform public.recruitment_action('register',m,registration);
  perform public.recruitment_action('register',old_free,registration);
  if public.list_hire_test_invoices() <> '[]' then raise exception 'Pending recruitment exposed an invoice'; end if;
  begin perform public.claim_hire_test_invoice_mail('billing@example.invalid'); raise exception 'Company claimed invoice mail'; exception when insufficient_privilege then null; end;
  perform public.save_company_billing_details(c,1,billing||'{"address_line1":"Ändrad testadress 2","invoice_email":"at-issue@example.invalid"}');
  begin perform public.list_hire_test_invoices(true); raise exception 'Company read admin list'; exception when insufficient_privilege then null; end;
  begin perform private.recruitment_action_before_hire_invoice('register',m,registration); raise exception 'Previous RPC bypass'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.hire_test_invoices; raise exception 'Direct invoice read'; exception when insufficient_privilege then null; end;

  perform pg_temp.invoice_actor(other_c);
  if public.hire_invoice_test_offer() is not null then raise exception 'Untrusted enrollment'; end if;
  perform public.recruitment_action('register',regular,registration-'test_invoice_terms');
  perform pg_temp.invoice_actor(y);
  perform public.recruitment_action('respond',m,approval);
  perform public.recruitment_action('respond',old_free,approval);
  perform public.recruitment_action('respond',regular,approval);
  if public.list_hire_test_invoices() <> '[]' then raise exception 'Candidate can read company invoices'; end if;
  perform pg_temp.invoice_actor(other_c);
  if public.list_hire_test_invoices() <> '[]' then raise exception 'Other company has test invoices'; end if;
  perform pg_temp.invoice_actor(c);
  perform public.save_company_billing_details(c,2,billing||'{"invoice_email":"after-issue@example.invalid"}');
  invoices := public.list_hire_test_invoices();
  if jsonb_array_length(invoices)<>2 then raise exception 'Duplicate invoice or missing approved invoice'; end if;
  select value into bill from jsonb_array_elements(invoices) where value->>'id'=(invoices->0->>'id');
  paid_invoice := (bill->>'id')::uuid;
  if (bill->>'amount_ore')::integer<>50000 or bill->>'address_line1'<>'Ursprunglig testadress 1'
    or (bill->>'due_on')::date - (bill->>'issued_on')::date<>30 or bill ? 'match_id' or bill ? 'company_user_id'
    then raise exception 'Incorrect invoice snapshot or private projection'; end if;
  begin perform public.record_hire_test_payment(paid_invoice,50000,'TEST-001'); raise exception 'Company settled its invoice'; exception when insufficient_privilege then null; end;

  perform pg_temp.invoice_actor(a);
  begin perform public.list_hire_test_invoices(true); raise exception 'Admin at AAL1'; exception when insufficient_privilege then null; end;
  perform pg_temp.invoice_actor(a,'aal2');
  if jsonb_array_length(public.list_hire_test_invoices(true))<>2 then raise exception 'Admin cannot see issued synthetic invoices'; end if;
  begin perform public.record_hire_test_payment(paid_invoice,100000,'TEST-001'); raise exception 'Wrong amount settled'; exception when invalid_parameter_value then null; end;
  begin perform public.record_hire_test_payment(paid_invoice,50000,'REAL-001'); raise exception 'Non-test reference settled'; exception when invalid_parameter_value then null; end;
  perform public.record_hire_test_payment(paid_invoice,50000,'TEST-001');
  perform public.record_hire_test_payment(paid_invoice,50000,'TEST-001');
  held_invoice := (invoices->1->>'id')::uuid;
  begin perform public.record_hire_test_payment(held_invoice,50000,'TEST-001'); raise exception 'Reused payment reference settled'; exception when invalid_parameter_value then null; end;
  reset role;
  if (select count(*) from private.hire_test_invoice_mail where invoice_id in (paid_invoice,held_invoice) and recipient='at-issue@example.invalid' and state='pending')<>2 then
    raise exception 'Invoice mail jobs do not preserve the recipient at issuance';
  end if;
  if (select count(*) from private.hire_test_invoices where company_user_id=c and paid_at is not null)<>1 then raise exception 'Settlement not saved exactly once'; end if;
  if exists(select 1 from public.employment_records where match_id in(m,old_free,regular) and paid_at is not null) then raise exception 'Test payment contaminated real hire records'; end if;
  select match_id into old_free from private.hire_test_invoices where id=held_invoice;
  set local role authenticated;
  perform pg_temp.invoice_actor(y);
  approval := jsonb_set(approval,'{expected_employment,response}','"approved"');
  perform public.recruitment_action('respond',old_free,approval||'{"response":"disputed"}');
  perform pg_temp.invoice_actor(a,'aal2');
  begin perform public.record_hire_test_payment(held_invoice,50000,'TEST-002'); raise exception 'Disputed test invoice paid'; exception when invalid_parameter_value then null; end;
  if not exists(select 1 from jsonb_array_elements(public.list_hire_test_invoices(true)) as item where item->>'id'=held_invoice::text and item->>'held_at' is not null) then raise exception 'Dispute did not hold invoice'; end if;
  reset role;
  if (select state from private.hire_test_invoice_mail where invoice_id=held_invoice) is distinct from 'cancelled' then raise exception 'Dispute did not cancel pending mail'; end if;
  set local role service_role;
  if public.get_hire_invoice_mail_recipient(repeat('0',64)) is not null then raise exception 'Bad scheduler token leaked recipient'; end if;
  if public.claim_hire_test_invoice_mail('after-issue@example.invalid') is not null then raise exception 'Mailbox change redirected issued email'; end if;
  mail_job := public.claim_hire_test_invoice_mail('at-issue@example.invalid');
  lease := (mail_job->>'lease')::uuid;
  if (mail_job->'invoice'->>'id')::uuid is distinct from paid_invoice or lease is null then raise exception 'Mail claim missing invoice'; end if;
  if public.claim_hire_test_invoice_mail('at-issue@example.invalid') is not null then raise exception 'Mail leased twice'; end if;
  if not public.hire_test_invoice_mail_ready(paid_invoice,lease) then raise exception 'Current lease not ready'; end if;
  if not public.finish_hire_test_invoice_mail(paid_invoice,lease,'retry') then raise exception 'Retry not recorded'; end if;
  if public.claim_hire_test_invoice_mail('at-issue@example.invalid') is not null then raise exception 'Retry ignored backoff'; end if;
  reset role;
  update private.hire_test_invoice_mail set available_at=now() where invoice_id=paid_invoice;
  set local role service_role;
  mail_job := public.claim_hire_test_invoice_mail('at-issue@example.invalid');
  if public.finish_hire_test_invoice_mail(paid_invoice,lease,'sent') then raise exception 'Stale lease completed mail'; end if;
  lease := (mail_job->>'lease')::uuid;
  if not public.finish_hire_test_invoice_mail(paid_invoice,lease,'sent') then raise exception 'Mail send not recorded'; end if;
  if public.claim_hire_test_invoice_mail('at-issue@example.invalid') is not null then raise exception 'Delivered mail was claimed again'; end if;
  reset role;
  update private.hire_test_invoice_mail set state='sending', sent_at=null, lease_token=lease, lease_until=now()-interval '1 minute' where invoice_id=paid_invoice;
  set local role service_role;
  if public.claim_hire_test_invoice_mail('at-issue@example.invalid') is not null then raise exception 'Uncertain SMTP delivery was retried'; end if;
  reset role;
  if (select state from private.hire_test_invoice_mail where invoice_id=paid_invoice) is distinct from 'review' then raise exception 'Expired delivery was not quarantined'; end if;
end;
$$;
select 'PASS: invoice controls and mail recipient snapshot, service-only access, dispute cancellation, lease, backoff, completion and uncertain delivery' as result;
rollback;
