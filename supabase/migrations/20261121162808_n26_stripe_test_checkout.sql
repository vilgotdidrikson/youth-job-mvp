-- Sandbox Checkout state belongs to a test invoice and is never exposed to clients.
create table private.hire_test_stripe_checkout (
  invoice_id uuid primary key references private.hire_test_invoices(id) on delete cascade,
  attempt_id uuid not null unique default gen_random_uuid(),
  reserved_at timestamptz not null default now(),
  session_id text unique check (session_id ~ '^cs_test_[A-Za-z0-9]+$')
);

alter table private.hire_test_stripe_checkout enable row level security;
revoke all on private.hire_test_stripe_checkout from public, anon, authenticated, service_role;

create function private.guard_hire_test_stripe_settlement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.paid_at is null and new.paid_at is not null and exists (
    select 1 from private.hire_test_stripe_checkout c
    where c.invoice_id = old.id and new.payment_reference is distinct from c.session_id
  ) then
    raise exception 'En Stripe-testbetalning pågår. Kontrollera den innan manuell avstämning.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_hire_test_stripe_settlement() from public, anon, authenticated, service_role;
create trigger guard_hire_test_stripe_settlement
before update of paid_at on private.hire_test_invoices
for each row execute function private.guard_hire_test_stripe_settlement();

create function private.hire_test_stripe_checkout(
  p_action text, p_invoice uuid, p_company uuid, p_attempt uuid, p_session text, p_amount integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  invoice private.hire_test_invoices%rowtype;
  checkout private.hire_test_stripe_checkout%rowtype;
begin
  -- The shared invoice lock serializes Stripe and manual settlement.
  select * into invoice from private.hire_test_invoices where id = p_invoice for update;
  if not found or invoice.issued_on is null then return null; end if;
  select * into checkout from private.hire_test_stripe_checkout where invoice_id = p_invoice;
  if p_action = 'reserve' then
    if p_company is null or invoice.company_user_id <> p_company
      or not exists (select 1 from auth.users u where u.id = p_company
        and u.raw_app_meta_data @> '{"hire_invoice_test": true, "invoice_pilot_role": "company"}'::jsonb
        and u.raw_app_meta_data ? 'invoice_pilot_owner') then
      return null;
    end if;
    if invoice.paid_at is not null then return jsonb_build_object('paid', true); end if;
    if invoice.held_at is not null or invoice.amount_ore <= 0 then return null; end if;
    if checkout.attempt_id is null then
      insert into private.hire_test_stripe_checkout (invoice_id) values (p_invoice) returning * into checkout;
    end if;
    return jsonb_build_object('attempt', checkout.attempt_id, 'reservedAt', checkout.reserved_at,
      'session', checkout.session_id, 'amount', invoice.amount_ore);
  end if;

  if checkout.attempt_id is null or checkout.attempt_id is distinct from p_attempt
    or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9]+$'
    or (checkout.session_id is not null and checkout.session_id <> p_session)
    or p_amount is distinct from invoice.amount_ore then
    return null;
  end if;

  if p_action = 'expire' then
    if invoice.paid_at is null then delete from private.hire_test_stripe_checkout where invoice_id = p_invoice; end if;
  elsif p_action in ('attach', 'settle') then
    if invoice.paid_at is not null then
      return case when invoice.payment_reference = p_session then jsonb_build_object('paid', true) else null end;
    end if;
    if p_action = 'attach' and invoice.held_at is not null then return null; end if;
    update private.hire_test_stripe_checkout set session_id = p_session where invoice_id = p_invoice;
    if p_action = 'settle' then
      update private.hire_test_invoices set paid_at = now(), payment_reference = p_session where id = p_invoice;
    end if;
  else
    return null;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.hire_test_stripe_checkout(
  p_action text, p_invoice uuid, p_company uuid, p_attempt uuid, p_session text, p_amount integer
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.hire_test_stripe_checkout(p_action, p_invoice, p_company, p_attempt, p_session, p_amount);
$$;

revoke all on function private.hire_test_stripe_checkout(text,uuid,uuid,uuid,text,integer),
  public.hire_test_stripe_checkout(text,uuid,uuid,uuid,text,integer) from public, anon, authenticated, service_role;
grant execute on function private.hire_test_stripe_checkout(text,uuid,uuid,uuid,text,integer),
  public.hire_test_stripe_checkout(text,uuid,uuid,uuid,text,integer) to service_role;
