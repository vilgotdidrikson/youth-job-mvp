-- Delivery outbox for the synthetic invoice flow. A separate row keeps recipient PII out of invoice RPCs.
create table private.hire_test_invoice_mail (
  invoice_id uuid primary key references private.hire_test_invoices(id) on delete cascade,
  recipient text not null,
  state text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'review', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 4),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  check ((state = 'sending') = (lease_token is not null and lease_until is not null)),
  check ((state = 'sent') = (sent_at is not null))
);
create index hire_test_invoice_mail_pending_idx on private.hire_test_invoice_mail(recipient, available_at) where state = 'pending';
alter table private.hire_test_invoice_mail enable row level security;
revoke all on private.hire_test_invoice_mail from public, anon, authenticated, service_role;

create or replace function private.update_hire_test_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.response = 'approved' then
    with issued as (
      update private.hire_test_invoices
      set issued_on = timezone('Europe/Stockholm', now())::date,
          due_on = timezone('Europe/Stockholm', now())::date + 30
      where match_id = new.match_id and issued_on is null
      returning id, company_user_id
    )
    insert into private.hire_test_invoice_mail(invoice_id, recipient)
    select issued.id, b.invoice_email
    from issued join public.company_billing_details b on b.user_id = issued.company_user_id;
  elsif new.response = 'disputed' then
    with held as (
      update private.hire_test_invoices set held_at = coalesce(held_at, now())
      where match_id = new.match_id and issued_on is not null returning id
    )
    update private.hire_test_invoice_mail
    set state = 'cancelled'
    where invoice_id in (select id from held) and state = 'pending';
  end if;
  return new;
end;
$$;

create function public.claim_hire_test_invoice_mail(p_recipient text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed private.hire_test_invoice_mail%rowtype;
begin
  -- A lost connection may occur after acceptance. Quarantine expired sends instead of retrying them.
  update private.hire_test_invoice_mail set state = 'review', lease_token = null, lease_until = null
  where state = 'sending' and lease_until <= now();
  with next_job as (
    select m.invoice_id from private.hire_test_invoice_mail m
    join private.hire_test_invoices i on i.id = m.invoice_id
    where m.recipient = p_recipient and m.state = 'pending' and m.available_at <= now()
      and i.issued_on is not null and i.held_at is null
    order by m.available_at, m.invoice_id
    limit 1 for update of m skip locked
  )
  update private.hire_test_invoice_mail m
  set state = 'sending', attempts = attempts + 1, lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes'
  from next_job where m.invoice_id = next_job.invoice_id
  returning m.* into claimed;
  if not found then return null; end if;

  return (select jsonb_build_object(
    'invoice', to_jsonb(i) - 'match_id' - 'company_user_id' - 'terms_version' - 'accepted_at' - 'payment_reference',
    'recipient', claimed.recipient, 'lease', claimed.lease_token
  ) from private.hire_test_invoices i where i.id = claimed.invoice_id);
end;
$$;

create function public.hire_test_invoice_mail_ready(p_invoice uuid, p_lease uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.hire_test_invoice_mail m
    join private.hire_test_invoices i on i.id = m.invoice_id
    where i.id = p_invoice and i.held_at is null and m.state = 'sending'
      and m.lease_token = p_lease and m.lease_until > now()
  );
$$;

create function public.finish_hire_test_invoice_mail(p_invoice uuid, p_lease uuid, p_outcome text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('sent', 'retry', 'review', 'cancelled') then
    raise exception 'Invalid invoice email outcome' using errcode = '22023';
  end if;
  update private.hire_test_invoice_mail m
  set state = case when p_outcome <> 'retry' then p_outcome
        when exists (select 1 from private.hire_test_invoices where id = p_invoice and held_at is not null) then 'cancelled'
        when attempts < 4 then 'pending' else 'review' end,
      available_at = case when p_outcome = 'retry' then now() + interval '5 minutes' * attempts else available_at end,
      sent_at = case when p_outcome = 'sent' then now() end,
      lease_token = null, lease_until = null
  where invoice_id = p_invoice and state = 'sending' and lease_token = p_lease and lease_until > now();
  return found;
end;
$$;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'mnw_hire_invoice_mail_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mnw_hire_invoice_mail_token');
  end if;
end;
$$;

create function public.get_hire_invoice_mail_recipient(p_token text)
returns text language sql stable security definer set search_path = '' as $$
  select lower(btrim(recipient.decrypted_secret))
  from vault.decrypted_secrets recipient
  where recipient.name = 'mnw_hire_invoice_mail_test_recipient'
    and length(p_token) = 64 and p_token = (
      select decrypted_secret from vault.decrypted_secrets where name = 'mnw_hire_invoice_mail_token' limit 1
    )
  limit 1;
$$;

revoke all on function public.claim_hire_test_invoice_mail(text), public.hire_test_invoice_mail_ready(uuid, uuid),
  public.finish_hire_test_invoice_mail(uuid, uuid, text), public.get_hire_invoice_mail_recipient(text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_hire_test_invoice_mail(text), public.hire_test_invoice_mail_ready(uuid, uuid),
  public.finish_hire_test_invoice_mail(uuid, uuid, text), public.get_hire_invoice_mail_recipient(text) to service_role;

create function private.dispatch_hire_invoice_mail()
returns void language plpgsql security definer set search_path = '' as $$
declare
  approved_recipient text;
  credential text;
begin
  select lower(btrim(decrypted_secret)) into approved_recipient
    from vault.decrypted_secrets where name = 'mnw_hire_invoice_mail_test_recipient' limit 1;
  if approved_recipient is null or not exists (
    select 1 from private.hire_test_invoice_mail
    where (state = 'pending' and available_at <= now() and hire_test_invoice_mail.recipient = approved_recipient)
       or (state = 'sending' and lease_until <= now())
  ) then return; end if;

  select decrypted_secret into credential from vault.decrypted_secrets where name = 'mnw_hire_invoice_mail_token' limit 1;
  if credential is null then return; end if;
  perform net.http_post(
    url := 'https://youth-job-mvp-dev.vercel.app/api/internal/hire-invoice-mail',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || credential),
    body := '{}'::jsonb, timeout_milliseconds := 55000
  );
end;
$$;
revoke all on function private.dispatch_hire_invoice_mail() from public, anon, authenticated, service_role;
select cron.schedule('mnw-hire-invoice-mail', '* * * * *', 'select private.dispatch_hire_invoice_mail()');
