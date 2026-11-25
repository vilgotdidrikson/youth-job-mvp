-- Synthetic candidates enter the test chat directly after login.
create or replace function public.prepare_hire_invoice_pilot_accounts(p_company uuid, p_youth uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  j uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  test_recipient text;
begin
  if not private.hire_test_invoice_admin() then raise exception 'Admin with MFA required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hire-invoice-pilot:'||auth.uid()::text,0));
  if not exists (select 1 from public.hire_invoice_pilot_accounts() where id=p_company and fixture_role='company')
    or not exists (select 1 from public.hire_invoice_pilot_accounts() where id=p_youth and fixture_role='youth')
    or not exists (select 1 from auth.users where id=p_company and raw_app_meta_data->'hire_invoice_test'='true'::jsonb)
    or exists (select 1 from public.jobs where company_user_id=p_company)
  then raise exception 'Invalid test account pair' using errcode='22023'; end if;

  select lower(btrim(decrypted_secret)) into test_recipient
  from vault.decrypted_secrets where name='mnw_hire_invoice_mail_test_recipient';
  if test_recipient is null or test_recipient !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$' then
    raise exception 'Configure a test inbox before preparing invoice fixtures' using errcode='22023';
  end if;

  update public.company_profiles set company_name='Fiktivt fakturabolag',verification_status='verified',verified_at=now()
  where user_id=p_company;
  if not found then raise exception 'Company profile missing'; end if;
  update public.youth_profiles set full_name='Fiktiv fakturakandidat',short_onboarding_completed=true where user_id=p_youth;
  if not found then raise exception 'Candidate profile missing'; end if;
  insert into public.company_billing_details(user_id,invoice_email,address_line1,postal_code,city)
  values(p_company,test_recipient,'Testgatan 1','12345','Testort');
  insert into public.jobs(id,company_user_id,company_name,title,description,address,status)
  values(j,p_company,'Fiktivt fakturabolag','Fiktiv testanställning','Endast för fakturatest i DevStaging','Testgatan 1','paused');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(m,p_youth,p_company,j,'matched');
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
  select m,p_youth,p_company,j where not exists(select 1 from public.conversations where match_id=m);
  return m;
end;
$$;
