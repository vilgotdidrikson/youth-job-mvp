-- Keep each already accepted invoice amount. New invoices take their amount from the accepted offer.
alter table private.hire_bank_invoices
  alter column amount_ore drop default,
  drop constraint hire_bank_invoices_amount_ore_check,
  add constraint hire_bank_invoices_amount_ore_check check (amount_ore in (50000, 80000));

create function private.hire_bank_release_tariff(p_launch_on text, p_today date)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  launch_on date;
  regular_on date;
begin
  if p_launch_on is null or p_launch_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;
  launch_on := p_launch_on::date;
  if p_today < launch_on then return null; end if;
  regular_on := (launch_on + interval '3 months')::date;
  return jsonb_build_object('amount_ore', case when p_today < regular_on then 50000 else 80000 end,
    'regular_on', regular_on);
exception when invalid_datetime_format or datetime_field_overflow then return null;
end;
$$;
revoke all on function private.hire_bank_release_tariff(text,date) from public, anon, authenticated, service_role;

create or replace function private.hire_bank_invoice_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case coalesce(cfg->>'scope','pilot')
    when 'pilot' then
      case when u.raw_app_meta_data->'hire_bank_invoice_pilot'='true'::jsonb
        then cfg || jsonb_build_object('amount_ore',50000) end
    when 'release' then
      cfg || private.hire_bank_release_tariff(cfg->>'launch_on', timezone('Europe/Stockholm',statement_timestamp())::date)
    end
  from auth.users u cross join (select private.hire_bank_invoice_config() as cfg) configured
  where u.id=auth.uid() and u.email not like '%@example.invalid' and public.is_verified_company(u.id);
$$;

create or replace function public.get_hire_bank_invoice_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',cfg->>'terms_version',
    'acceptance',encode(extensions.digest(cfg::text,'sha256'),'hex'),
    'terms',cfg->>'terms','seller',cfg #>> '{seller,name}','amount_ore',cfg->'amount_ore')
  from (select private.hire_bank_invoice_offer() as cfg) configured where cfg is not null;
$$;

create function public.get_public_hire_tariff()
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.hire_bank_release_tariff(cfg->>'launch_on',timezone('Europe/Stockholm',statement_timestamp())::date)
  from (select private.hire_bank_invoice_config() as cfg) configured where cfg->>'scope'='release';
$$;
revoke all on function public.get_public_hire_tariff() from public, anon, authenticated, service_role;
grant execute on function public.get_public_hire_tariff() to anon, authenticated;

create or replace function private.recruitment_action(p_action text,p_match_id uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb;
  b public.company_billing_details%rowtype;
  company_org text;
  result jsonb;
begin
  if p_action='register' then
    cfg := private.hire_bank_invoice_offer();
    if cfg is not null or p_payload ? 'bank_invoice_terms' then
      perform 1 from public.matches where id=p_match_id and company_user_id=auth.uid() for update;
      if found and not exists (select 1 from public.employment_records where match_id=p_match_id) then
        if cfg is null or p_payload->>'bank_invoice_terms' is distinct from encode(extensions.digest(cfg::text,'sha256'),'hex') then
          raise exception 'Pris eller villkor har ändrats. Öppna formuläret igen.' using errcode='40001';
        end if;
        select * into b from public.company_billing_details where user_id=auth.uid();
        select organization_number into company_org from public.company_profiles where user_id=auth.uid();
        if b.user_id is null or nullif(btrim(company_org),'') is null
          or b.invoice_email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$' then
          raise exception 'Spara korrekt fakturamejl, fakturaadress och organisationsnummer innan du registrerar.' using errcode='22023';
        end if;
        result := private.recruitment_action_with_test_invoice(p_action,p_match_id,p_payload);
        insert into private.hire_bank_invoices(match_id,company_user_id,buyer_name,buyer_org,address_line1,address_line2,
          postal_code,city,recipient,terms_version,terms_text,seller,amount_ore)
        values(p_match_id,auth.uid(),result->>'company_name',company_org,b.address_line1,b.address_line2,
          b.postal_code,b.city,b.invoice_email,cfg->>'terms_version',cfg->>'terms',
          jsonb_build_object('name',cfg #>> '{seller,name}','address',cfg #>> '{seller,address}',
            'reference',cfg #>> '{seller,reference}','bankgiro',cfg #>> '{seller,bankgiro}'), (cfg->>'amount_ore')::integer);
        return result;
      end if;
    end if;
  end if;
  return private.recruitment_action_with_test_invoice(p_action,p_match_id,p_payload);
end;
$$;

notify pgrst, 'reload schema';
