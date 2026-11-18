-- F06/L03: isolated test invoice flow. Only explicitly enrolled synthetic accounts qualify.
create table private.hire_test_invoices (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.employment_records(match_id) on delete cascade,
  company_user_id uuid not null references public.company_profiles(user_id) on delete cascade,
  amount_ore integer not null default 50000 check (amount_ore = 50000),
  terms_version text not null check (terms_version = 'test-launch-500-sek-v1'),
  accepted_at timestamptz not null default now(),
  buyer_name text not null,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  city text not null,
  issued_on date,
  due_on date,
  held_at timestamptz,
  paid_at timestamptz,
  payment_reference text unique,
  check ((issued_on is null) = (due_on is null)),
  check ((paid_at is null) = (payment_reference is null)),
  check (paid_at is null or issued_on is not null)
);
create index hire_test_invoices_company_idx on private.hire_test_invoices(company_user_id);
alter table private.hire_test_invoices enable row level security;
revoke all on private.hire_test_invoices from public, anon, authenticated, service_role;

create function private.hire_invoice_test_company()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.company_profiles c on c.user_id = u.id
    where u.id = auth.uid() and c.verification_status = 'verified'
      and u.email like '%@example.invalid'
      and u.raw_app_meta_data->'hire_invoice_test' = 'true'::jsonb
  );
$$;
revoke all on function private.hire_invoice_test_company() from public, anon, authenticated, service_role;
grant execute on function private.hire_invoice_test_company() to authenticated;

create function public.hire_invoice_test_offer()
returns text language sql stable security invoker set search_path = '' as $$
  select case when private.hire_invoice_test_company() then 'test-launch-500-sek-v1' end;
$$;
revoke all on function public.hire_invoice_test_offer() from public, anon, authenticated, service_role;
grant execute on function public.hire_invoice_test_offer() to authenticated;

alter function private.recruitment_action(text, uuid, jsonb) rename to recruitment_action_before_hire_invoice;
revoke all on function private.recruitment_action_before_hire_invoice(text, uuid, jsonb) from public, anon, authenticated, service_role;

create function private.recruitment_action(p_action text, p_match_id uuid, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  bill public.company_billing_details%rowtype;
  result jsonb;
  terms constant text := 'test-launch-500-sek-v1';
begin
  if p_action = 'register' and private.hire_invoice_test_company() then
    perform 1 from public.matches where id = p_match_id and company_user_id = auth.uid() for update;
    if found and not exists (select 1 from public.employment_records where match_id = p_match_id) then
      if p_payload->>'test_invoice_terms' is distinct from terms then
        raise exception 'Bekräfta priset och villkoren för testfakturan.' using errcode = '22023';
      end if;
      select * into bill from public.company_billing_details where user_id = auth.uid();
      if not found then
        raise exception 'Spara fakturauppgifter i företagets inställningar först.' using errcode = '22023';
      end if;
      result := private.recruitment_action_before_hire_invoice(p_action, p_match_id, p_payload);
      insert into private.hire_test_invoices(match_id, company_user_id, terms_version, buyer_name,
        address_line1, address_line2, postal_code, city)
      values (p_match_id, auth.uid(), terms, result->>'company_name',
        bill.address_line1, bill.address_line2, bill.postal_code, bill.city);
      return result;
    end if;
  end if;
  return private.recruitment_action_before_hire_invoice(p_action, p_match_id, p_payload);
end;
$$;
revoke all on function private.recruitment_action(text, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.recruitment_action(text, uuid, jsonb) to authenticated;

create or replace function public.recruitment_action(p_action text, p_match_id uuid default null, p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select private.recruitment_action(p_action, p_match_id, p_payload);
$$;

create function private.update_hire_test_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.response = 'approved' then
    update private.hire_test_invoices
    set issued_on = timezone('Europe/Stockholm', now())::date,
        due_on = timezone('Europe/Stockholm', now())::date + 30
    where match_id = new.match_id and issued_on is null;
  elsif new.response = 'disputed' then
    update private.hire_test_invoices set held_at = coalesce(held_at, now())
    where match_id = new.match_id and issued_on is not null;
  end if;
  return new;
end;
$$;
revoke all on function private.update_hire_test_invoice() from public, anon, authenticated, service_role;
create trigger update_hire_test_invoice after update of response on public.employment_records
for each row when (old.response is distinct from new.response) execute function private.update_hire_test_invoice();

create function private.hire_test_invoice_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2' and public.is_admin_account(), false);
$$;
revoke all on function private.hire_test_invoice_admin() from public, anon, authenticated, service_role;

create function private.list_hire_test_invoices(p_admin boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_admin then
    if not private.hire_test_invoice_admin() then
      raise exception 'Verifierad adminåtkomst krävs.' using errcode = '42501';
    end if;
  elsif not private.hire_invoice_test_company() then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(i) - 'match_id' - 'company_user_id' - 'terms_version' - 'accepted_at' - 'payment_reference'
      order by i.issued_on desc, i.id)
    from private.hire_test_invoices i
    where i.issued_on is not null and (p_admin is true or i.company_user_id = auth.uid())), '[]'::jsonb);
end;
$$;

create function private.record_hire_test_payment(p_invoice uuid, p_amount_ore integer, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare invoice private.hire_test_invoices%rowtype;
begin
  if not private.hire_test_invoice_admin() then
    raise exception 'Verifierad adminåtkomst krävs.' using errcode = '42501';
  end if;
  if p_reference is null or p_reference !~ '^TEST-[A-Z0-9-]{2,35}$' then
    raise exception 'Ange en fiktiv betalningsreferens med prefixet TEST-.' using errcode = '22023';
  end if;
  select * into invoice from private.hire_test_invoices where id = p_invoice for update;
  if not found or invoice.issued_on is null or invoice.held_at is not null
      or invoice.amount_ore is distinct from p_amount_ore then
    raise exception 'Fakturan kan inte stämmas av. Kontrollera belopp och status.' using errcode = '22023';
  end if;
  if invoice.paid_at is not null then
    if invoice.payment_reference = p_reference then return; end if;
    raise exception 'En testbetalning är redan avstämd.' using errcode = '22023';
  end if;
  update private.hire_test_invoices set paid_at = now(), payment_reference = p_reference where id = p_invoice;
exception when unique_violation then
  raise exception 'Testreferensen används redan på en annan faktura.' using errcode = '22023';
end;
$$;

create function public.list_hire_test_invoices(p_admin boolean default false)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.list_hire_test_invoices(p_admin);
$$;
create function public.record_hire_test_payment(p_invoice uuid, p_amount_ore integer, p_reference text)
returns void language sql security invoker set search_path = '' as $$
  select private.record_hire_test_payment(p_invoice, p_amount_ore, p_reference);
$$;
revoke all on function private.list_hire_test_invoices(boolean), public.list_hire_test_invoices(boolean),
  private.record_hire_test_payment(uuid, integer, text), public.record_hire_test_payment(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function private.list_hire_test_invoices(boolean), public.list_hire_test_invoices(boolean),
  private.record_hire_test_payment(uuid, integer, text), public.record_hire_test_payment(uuid, integer, text) to authenticated;
