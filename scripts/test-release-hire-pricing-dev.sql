-- Include in a rollback transaction on DevStaging after applying the review migrations.
do $$
declare
  admin uuid := gen_random_uuid();
  company uuid := gen_random_uuid();
  candidate uuid := gen_random_uuid();
  vacancy uuid := gen_random_uuid();
  introductory_match uuid := gen_random_uuid();
  regular_match uuid := gen_random_uuid();
  activation uuid;
  today date := timezone('Europe/Stockholm',statement_timestamp())::date;
  config jsonb;
  offer jsonb;
  fresh_offer jsonb;
  approval jsonb := jsonb_build_object('response','approved','expected_employment',
    jsonb_build_object('role_name','QA testtjänst','start_date',today::text,'response','pending'));
  form jsonb := jsonb_build_object('role_name','QA testtjänst','start_date',today::text,'expected_employment',null);
begin
  if exists (select 1 from vault.secrets where name='mnw_hire_bank_invoice_config') then
    raise exception 'Billing fixtures require an unconfigured staging environment';
  end if;
  if (private.hire_bank_release_tariff('2026-11-30','2027-02-27')->>'amount_ore')::int is distinct from 50000
    or (private.hire_bank_release_tariff('2026-11-30','2027-02-28')->>'amount_ore')::int is distinct from 80000
    or private.hire_bank_release_tariff('2026-11-30','2026-11-29') is not null
    or private.hire_bank_release_tariff('2026-02-29','2026-03-01') is not null
    or private.hire_bank_release_tariff('tomorrow','2026-03-01') is not null then
    raise exception 'Invalid calendar boundary';
  end if;

  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
    (admin,'qa-price-'||admin||'@example.invalid','{"role":"private"}','{}'),
    (company,'qa-price-'||company||'@example.test','{"role":"company"}','{}'),
    (candidate,'qa-price-'||candidate||'@example.invalid','{"role":"youth"}','{}');
  insert into public.admin_users(user_id) values(admin);
  perform set_config('request.jwt.claim.sub',admin::text,true);
  update public.company_profiles set company_name='Fiktivt prisprov',
    organization_number='556016-0680',verification_status='verified' where user_id=company;
  insert into public.company_billing_details(user_id,invoice_email,address_line1,postal_code,city)
    values(company,'qa-price@example.invalid','Testgatan 1','12345','Testort');
  insert into public.jobs(id,company_user_id,company_name,title,description,address,status)
    values(vacancy,company,'Fiktivt prisprov','Prisprov','Fiktiv','Testgatan 1','paused');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status)
    values(introductory_match,candidate,company,vacancy,'matched');
  -- A second job avoids the unique constraint on candidate and vacancy.
  insert into public.jobs(id,company_user_id,company_name,title,description,address,status)
    values(regular_match,company,'Fiktivt prisprov','Andra prisprovet','Fiktiv','Testgatan 1','paused');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status)
    values(regular_match,candidate,company,regular_match,'matched');

  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
    select m.id,m.youth_user_id,m.company_user_id,m.job_id
    from public.matches m where m.id in (introductory_match,regular_match)
      and not exists (select 1 from public.conversations c where c.match_id=m.id);

  config := '{"enabled":true,"uf_tax_reviewed":true,"tax_decision_reference":"Fiktivt QA-beslut",
    "terms_version":"bankgiro-qa-release","terms":"Fiktiva betalningsvillkor för QA.",
    "scope":"release","seller":{"name":"Fiktivt QA-företag","address":"Testgatan 1, 12345 Testort",
    "reference":"QA-referens","bankgiro":"1234567"}}';
  activation := vault.create_secret((config||jsonb_build_object('launch_on',today+1))::text,'mnw_hire_bank_invoice_config');
  set local role anon;
  if public.get_public_hire_tariff() is not null then raise exception 'Public tariff started early'; end if;
  reset role;
  perform vault.update_secret(activation,(config||jsonb_build_object('launch_on',today))::text);
  set local role anon;
  if public.get_public_hire_tariff() is distinct from
    jsonb_build_object('amount_ore',50000,'regular_on',(today+interval '3 months')::date) then
    raise exception 'Public tariff is wrong or exposed private fields';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub',company::text,true);
  set local role authenticated;
  offer := public.get_hire_bank_invoice_offer();
  if offer->>'amount_ore' is distinct from '50000' then raise exception 'Company tariff missing or wrong'; end if;
  perform public.recruitment_action('register',introductory_match,form||jsonb_build_object('bank_invoice_terms',offer->>'acceptance'));
  if public.list_hire_bank_invoices() is distinct from '[]'::jsonb then raise exception 'Invoice issued before confirmation'; end if;
  reset role;

  perform vault.update_secret(activation,(config||jsonb_build_object('launch_on',(today-interval '4 months')::date))::text);
  set local role authenticated;
  fresh_offer := public.get_hire_bank_invoice_offer();
  if fresh_offer->>'amount_ore' is distinct from '80000' then raise exception 'Regular tariff missing or wrong'; end if;
  begin
    perform public.recruitment_action('register',regular_match,form||jsonb_build_object('bank_invoice_terms',offer->>'acceptance'));
    raise exception 'Stale offer was accepted';
  exception when serialization_failure then null; end;
  perform public.recruitment_action('register',regular_match,form||jsonb_build_object('bank_invoice_terms',fresh_offer->>'acceptance'));
  reset role;

  if (select amount_ore from private.hire_bank_invoices where match_id=introductory_match) is distinct from 50000
    or (select amount_ore from private.hire_bank_invoices where match_id=regular_match) is distinct from 80000 then
    raise exception 'Accepted invoice amount was not preserved';
  end if;
  perform set_config('request.jwt.claim.sub',candidate::text,true);
  set local role authenticated;
  if public.get_hire_bank_invoice_offer() is not null then raise exception 'Candidate got company payment terms'; end if;
  perform public.recruitment_action('respond',introductory_match,approval);
  perform public.recruitment_action('respond',regular_match,approval);
  perform set_config('request.jwt.claim.sub',company::text,true);
  if (select array_agg((invoice->>'amount_ore')::integer order by (invoice->>'amount_ore')::integer)
    from jsonb_array_elements(public.list_hire_bank_invoices()) invoice) is distinct from array[50000,80000] then
    raise exception 'Confirmation did not issue the original amounts';
  end if;
  reset role;
end $$;
