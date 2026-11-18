-- DevStaging only. Temporary identities, activation, and issued invoices are rolled back.
begin;
create function pg_temp.pilot_actor(u uuid, assurance text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal',assurance)::text,true);
end;
$$;
do $$
declare
  a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); y uuid:=gen_random_uuid();
  tc uuid:=gen_random_uuid(); ty uuid:=gen_random_uuid();
  j uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
  activation uuid; invoice_id uuid; link_match uuid;
  cfg jsonb:='{"enabled":true,"uf_tax_reviewed":true,"tax_decision_reference":"Fiktivt beslut i rollbackprov","terms_version":"bankgiro-test-v1","terms":"Testvillkor för ett fiktivt återställningsprov.","seller":{"name":"Fiktivt övningsföretag","address":"Testgatan 1, 12345 Testort","reference":"Fiktiv referens","bankgiro":"1234567"}}';
  form jsonb:=jsonb_build_object('role_name','Fiktiv tjänst','start_date',current_date::text,'expected_employment',null);
  approval jsonb:=jsonb_build_object('response','approved','expected_employment',jsonb_build_object('role_name','Fiktiv tjänst','start_date',current_date::text,'response','pending'));
  details jsonb:='{"invoice_email":"fake-invoice@example.invalid","address_line1":"Avtalad testadress 1","address_line2":"","postal_code":"12345","city":"Testort","reference":""}';
  offer jsonb; invoice jsonb; mail_job jsonb; lease uuid;
begin
  if private.hire_bank_invoice_config() is not null or exists(select 1 from vault.secrets where name='mnw_hire_bank_invoice_config') then
    raise exception 'Refusing to test in a configured billing environment';
  end if;
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
    (a,'test-admin-'||a||'@example.invalid','{"role":"private"}','{}'),
    (c,'test-bank-company-'||c||'@example.test','{"role":"company"}','{"hire_bank_invoice_pilot":true}'),
    (y,'test-bank-youth-'||y||'@example.invalid','{"role":"youth"}','{}'),
    (tc,'mnw-invoice-company-'||a||'@example.invalid','{"role":"company"}',jsonb_build_object('invoice_pilot_owner',a::text,'invoice_pilot_role','company','hire_invoice_test',true)),
    (ty,'mnw-invoice-youth-'||a||'@example.invalid','{"role":"youth"}',jsonb_build_object('invoice_pilot_owner',a::text,'invoice_pilot_role','youth'));
  insert into public.admin_users(user_id) values(a);
  perform pg_temp.pilot_actor(a,'aal2');
  update public.company_profiles set company_name='Fiktiv köpare',organization_number='559000-0000',verification_status='verified' where user_id=c;
  insert into public.jobs(id,company_user_id,company_name,title,description,address,status)
  values(j,c,'Fiktiv köpare','Fiktiv bankgirotjänst','Test','Testgatan 2','paused');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values (m,y,c,j,'matched');
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
  select m,y,c,j where not exists(select 1 from public.conversations where match_id=m);

  set local role authenticated;
  link_match:=public.prepare_hire_invoice_pilot_accounts(tc,ty);
  if link_match is null or (select count(*) from public.hire_invoice_pilot_accounts())<>2 then raise exception 'Pilot fixture failed'; end if;
  perform pg_temp.pilot_actor(ty);
  begin perform public.hire_invoice_pilot_accounts(); raise exception 'Candidate sees admin fixtures'; exception when insufficient_privilege then null; end;
  perform pg_temp.pilot_actor(tc);
  if public.hire_invoice_test_offer() is null then raise exception 'Pilot company not set up for test invoices'; end if;
  perform pg_temp.pilot_actor(c);
  if public.get_hire_bank_invoice_offer() is not null then raise exception 'Paid offer exposed without config'; end if;
  perform public.save_company_billing_details(c,null,details);
  reset role;
  if not exists (select 1 from public.youth_profiles where user_id=ty and short_onboarding_completed) then raise exception 'Candidate routed away from test chat'; end if;
  activation:=vault.create_secret(cfg::text,'mnw_hire_bank_invoice_config');

  set local role authenticated;
  perform pg_temp.pilot_actor(c);
  offer:=public.get_hire_bank_invoice_offer();
  if offer->>'version' is distinct from 'bankgiro-test-v1' or offer->>'acceptance' is null then raise exception 'Pilot offer missing'; end if;
  begin
    perform public.recruitment_action('register',m,form);
    raise exception 'Missing acceptance permitted';
  exception when serialization_failure then null; end;
  reset role;
  perform vault.update_secret(activation,(cfg||'{"terms":"Ändrade testvillkor med samma versionsnamn."}')::text);
  set local role authenticated;
  begin
    perform public.recruitment_action('register',m,form||jsonb_build_object('bank_invoice_terms',offer->>'acceptance'));
    raise exception 'Stale acceptance permitted';
  exception when serialization_failure then null; end;
  offer:=public.get_hire_bank_invoice_offer();
  form:=form||jsonb_build_object('bank_invoice_terms',offer->>'acceptance');
  perform public.recruitment_action('register',m,form);
  perform public.recruitment_action('register',m,form);
  if public.list_hire_bank_invoices() <> '[]' then raise exception 'Invoice exposed before confirmation'; end if;
  perform public.save_company_billing_details(c,1,details||'{"address_line1":"Ny adress efter avtal","invoice_email":"other-invoice@example.invalid"}');
  perform pg_temp.pilot_actor(y);
  perform public.recruitment_action('respond',m,approval);
  if public.list_hire_bank_invoices() <> '[]' then raise exception 'Candidate sees invoices'; end if;
  perform pg_temp.pilot_actor(c);
  invoice:=public.list_hire_bank_invoices()->0;
  invoice_id:=(invoice->>'id')::uuid;
  if (invoice->>'amount_ore')::integer<>50000 or invoice->>'address_line1' is distinct from 'Avtalad testadress 1'
    or invoice->>'invoice_email' is distinct from 'fake-invoice@example.invalid'
    or (invoice->>'due_on')::date-(invoice->>'issued_on')::date<>30
    or invoice->>'invoice_number' not like 'MNW-%' or invoice ? 'recipient'
    or jsonb_array_length(public.list_hire_bank_invoices())<>1 then raise exception 'Issued invoice facts wrong'; end if;
  begin perform public.record_hire_bank_payment(invoice_id,50000,'FAKE-BANK-01'); raise exception 'Company self-verified'; exception when insufficient_privilege then null;end;
  perform pg_temp.pilot_actor(a,'aal1');
  begin perform public.list_hire_bank_invoices(true); raise exception 'AAL1 admin accessed data'; exception when insufficient_privilege then null;end;
  perform pg_temp.pilot_actor(a,'aal2');
  begin perform public.record_hire_bank_payment(invoice_id,49900,'FAKE-BANK-01'); raise exception 'Wrong amount accepted'; exception when invalid_parameter_value then null;end;
  perform public.record_hire_bank_payment(invoice_id,50000,'FAKE-BANK-01');
  perform public.record_hire_bank_payment(invoice_id,50000,'FAKE-BANK-01');
  reset role;

  set local role service_role;
  mail_job:=public.claim_hire_bank_invoice_mail();
  lease:=(mail_job->>'lease')::uuid;
  if lease is null or mail_job->>'recipient' is distinct from 'fake-invoice@example.invalid'
     or not public.hire_bank_invoice_mail_ready(invoice_id,lease) then raise exception 'Mail snapshot or lease wrong';end if;
  if public.claim_hire_bank_invoice_mail() is not null then raise exception 'Duplicate claim';end if;
  if not public.finish_hire_bank_invoice_mail(invoice_id,lease,'sent') then raise exception 'Receipt failed';end if;
  if public.claim_hire_bank_invoice_mail() is not null then raise exception 'Duplicate send';end if;
  reset role;
  if not exists(select 1 from private.hire_bank_invoices where id=invoice_id and paid_at is not null and mail_state='sent') then raise exception 'Invoice settlement missing';end if;
  if exists(select 1 from private.hire_test_invoices where match_id=m) then raise exception 'Paid registration created a test invoice too';end if;
end $$;
select 'PASS: scoped admin fixtures, disabled-by-default bankgiro, explicit current terms, invoice PDF data, payment and delivery isolation' as result;
rollback;
