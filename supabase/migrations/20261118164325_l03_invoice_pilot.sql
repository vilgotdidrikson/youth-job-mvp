-- A verified DevStaging administrator can prepare only their own synthetic invoice test accounts.
create function public.hire_invoice_pilot_accounts()
returns table(id uuid, fixture_role text) language plpgsql security definer set search_path = '' as $$
begin
  if not private.hire_test_invoice_admin() then raise exception 'Admin with MFA required' using errcode='42501'; end if;
  return query select u.id, u.raw_app_meta_data->>'invoice_pilot_role'
  from auth.users u
  where u.raw_app_meta_data->>'invoice_pilot_owner'=auth.uid()::text
    and u.raw_app_meta_data->>'invoice_pilot_role' in ('company','youth')
    and u.email='mnw-invoice-'||(u.raw_app_meta_data->>'invoice_pilot_role')||'-'||auth.uid()::text||'@example.invalid';
end;
$$;

create function public.prepare_hire_invoice_pilot_accounts(p_company uuid, p_youth uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  j uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
begin
  if not private.hire_test_invoice_admin() then raise exception 'Admin with MFA required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hire-invoice-pilot:'||auth.uid()::text,0));
  if not exists (select 1 from public.hire_invoice_pilot_accounts() where id=p_company and fixture_role='company')
    or not exists (select 1 from public.hire_invoice_pilot_accounts() where id=p_youth and fixture_role='youth')
    or not exists (select 1 from auth.users where id=p_company and raw_app_meta_data->'hire_invoice_test'='true'::jsonb)
    or exists (select 1 from public.jobs where company_user_id=p_company)
  then raise exception 'Invalid test account pair' using errcode='22023'; end if;

  update public.company_profiles set company_name='Fiktivt fakturabolag',verification_status='verified',verified_at=now()
  where user_id=p_company;
  if not found then raise exception 'Company profile missing'; end if;
  update public.youth_profiles set full_name='Fiktiv fakturakandidat' where user_id=p_youth;
  if not found then raise exception 'Candidate profile missing'; end if;
  insert into public.company_billing_details(user_id,invoice_email,address_line1,postal_code,city)
  values(p_company,'info@matchnwork.se','Testgatan 1','12345','Testort');
  insert into public.jobs(id,company_user_id,company_name,title,description,address,status)
  values(j,p_company,'Fiktivt fakturabolag','Fiktiv testanställning','Endast för fakturatest i DevStaging','Testgatan 1','paused');
  insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(m,p_youth,p_company,j,'matched');
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
  select m,p_youth,p_company,j where not exists(select 1 from public.conversations where match_id=m);
  return m;
end;
$$;

revoke all on function public.hire_invoice_pilot_accounts(), public.prepare_hire_invoice_pilot_accounts(uuid,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.hire_invoice_pilot_accounts(), public.prepare_hire_invoice_pilot_accounts(uuid,uuid) to authenticated;

-- Accounting snapshots are separate from dev test records and survive account deletion.
create sequence private.hire_bank_invoice_number_seq;
create table private.hire_bank_invoices (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references public.matches(id) on delete set null,
  company_user_id uuid references public.company_profiles(user_id) on delete set null,
  buyer_name text not null,
  buyer_org text not null,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  city text not null,
  recipient text not null,
  accepted_at timestamptz not null default now(),
  terms_version text not null,
  terms_text text not null,
  seller jsonb not null,
  amount_ore integer not null default 50000 check (amount_ore = 50000),
  invoice_number text unique,
  issued_on date,
  due_on date,
  held_at timestamptz,
  paid_at timestamptz,
  payment_reference text unique,
  mail_state text not null default 'pending' check (mail_state in ('pending','sending','sent','review')),
  mail_attempts integer not null default 0 check (mail_attempts between 0 and 4),
  mail_available_at timestamptz not null default now(),
  mail_lease uuid,
  mail_lease_until timestamptz,
  check ((invoice_number is null) = (issued_on is null) and (issued_on is null) = (due_on is null)),
  check ((paid_at is null) = (payment_reference is null)),
  check ((mail_state='sending') = (mail_lease is not null and mail_lease_until is not null))
);
create index hire_bank_invoices_company_idx on private.hire_bank_invoices(company_user_id);
create index hire_bank_invoices_mail_idx on private.hire_bank_invoices(mail_available_at)
where invoice_number is not null and held_at is null and mail_state='pending';
alter table private.hire_bank_invoices enable row level security;
revoke all on private.hire_bank_invoices from public, anon, authenticated, service_role;
revoke all on sequence private.hire_bank_invoice_number_seq from public, anon, authenticated, service_role;

-- An operator sets this only once the UF classification and the final terms have been confirmed.
-- No migration creates or enables a live configuration.
create function private.hire_bank_invoice_config()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg jsonb;
begin
  select decrypted_secret::jsonb into cfg from vault.decrypted_secrets where name='mnw_hire_bank_invoice_config';
  if cfg->'enabled'='true'::jsonb and cfg->'uf_tax_reviewed'='true'::jsonb
    and length(btrim(cfg->>'tax_decision_reference')) between 3 and 300
    and cfg->>'terms_version' ~ '^bankgiro-[a-zA-Z0-9-]{1,50}$'
    and length(btrim(cfg->>'terms')) between 20 and 6000
    and length(btrim(cfg #>> '{seller,name}')) between 2 and 160
    and length(btrim(cfg #>> '{seller,address}')) between 3 and 250
    and length(btrim(cfg #>> '{seller,reference}')) between 2 and 100
    and cfg #>> '{seller,bankgiro}' ~ '^[0-9]{7,8}$'
  then return cfg; end if;
  return null;
exception when invalid_text_representation then return null;
end;
$$;
revoke all on function private.hire_bank_invoice_config() from public, anon, authenticated, service_role;

create function private.hire_bank_invoice_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.hire_bank_invoice_config()
  where exists (
    select 1 from auth.users u where u.id=auth.uid() and u.raw_app_meta_data->'hire_bank_invoice_pilot'='true'::jsonb
      and u.email not like '%@example.invalid' and public.is_verified_company(u.id)
  );
$$;
revoke all on function private.hire_bank_invoice_offer() from public, anon, authenticated, service_role;

create function public.get_hire_bank_invoice_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', cfg->>'terms_version',
    'acceptance',encode(extensions.digest(cfg::text,'sha256'),'hex'),
    'terms',cfg->>'terms','seller',cfg #>> '{seller,name}')
  from (select private.hire_bank_invoice_offer() as cfg) configured where cfg is not null;
$$;
revoke all on function public.get_hire_bank_invoice_offer() from public, anon, authenticated, service_role;
grant execute on function public.get_hire_bank_invoice_offer() to authenticated;

alter function private.recruitment_action(text,uuid,jsonb) rename to recruitment_action_with_test_invoice;
revoke all on function private.recruitment_action_with_test_invoice(text,uuid,jsonb) from public, anon, authenticated, service_role;

create function private.recruitment_action(p_action text,p_match_id uuid,p_payload jsonb default '{}')
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
          postal_code,city,recipient,terms_version,terms_text,seller)
        values(p_match_id,auth.uid(),result->>'company_name',company_org,b.address_line1,b.address_line2,
          b.postal_code,b.city,b.invoice_email,cfg->>'terms_version',cfg->>'terms',
          jsonb_build_object('name',cfg #>> '{seller,name}','address',cfg #>> '{seller,address}',
            'reference',cfg #>> '{seller,reference}','bankgiro',cfg #>> '{seller,bankgiro}'));
        return result;
      end if;
    end if;
  end if;
  return private.recruitment_action_with_test_invoice(p_action,p_match_id,p_payload);
end;
$$;
revoke all on function private.recruitment_action(text,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function private.recruitment_action(text,uuid,jsonb) to authenticated;
create or replace function public.recruitment_action(p_action text,p_match_id uuid default null,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select private.recruitment_action(p_action,p_match_id,p_payload);
$$;

create function private.issue_hire_bank_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_number text;
begin
  if new.response='approved' and exists(select 1 from private.hire_bank_invoices where match_id=new.match_id and invoice_number is null) then
    next_number := nextval('private.hire_bank_invoice_number_seq'::regclass)::text;
    update private.hire_bank_invoices set
       invoice_number='MNW-'||lpad(next_number,greatest(6,length(next_number)),'0'),
       issued_on=timezone('Europe/Stockholm',now())::date,
       due_on=timezone('Europe/Stockholm',now())::date+30
    where match_id=new.match_id and invoice_number is null;
  elsif new.response='disputed' then
    update private.hire_bank_invoices set held_at=coalesce(held_at,now())
    where match_id=new.match_id and invoice_number is not null;
  end if;
  return new;
end;
$$;
revoke all on function private.issue_hire_bank_invoice() from public, anon, authenticated, service_role;
create trigger issue_hire_bank_invoice after update of response on public.employment_records
for each row when (old.response is distinct from new.response) execute function private.issue_hire_bank_invoice();

create function private.hire_bank_invoice_document(i private.hire_bank_invoices)
returns jsonb language sql immutable set search_path = '' as $$
select jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'amount_ore',i.amount_ore,
  'buyer_name',i.buyer_name,'buyer_org',i.buyer_org,'address_line1',i.address_line1,'address_line2',i.address_line2,
  'postal_code',i.postal_code,'city',i.city,'issued_on',i.issued_on,'due_on',i.due_on,
  'seller',i.seller,'held_at',i.held_at,'paid_at',i.paid_at,'mail_state',i.mail_state);
$$;
revoke all on function private.hire_bank_invoice_document(private.hire_bank_invoices) from public, anon, authenticated, service_role;

create function public.list_hire_bank_invoices(p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_admin is true and not private.hire_test_invoice_admin() then
    raise exception 'Verifierad adminåtkomst krävs.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(private.hire_bank_invoice_document(i) order by i.issued_on desc,i.invoice_number desc)
    from private.hire_bank_invoices i
    where i.invoice_number is not null and (p_admin is true or i.company_user_id=auth.uid())), '[]'::jsonb);
end;
$$;

create function public.record_hire_bank_payment(p_invoice uuid,p_amount_ore integer,p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare i private.hire_bank_invoices%rowtype;
begin
  if not private.hire_test_invoice_admin() then raise exception 'Verifierad adminåtkomst krävs.' using errcode='42501'; end if;
  if p_reference is null or p_reference !~ '^[A-Z0-9-]{3,60}$' then raise exception 'Ange bankens transaktionsreferens.' using errcode='22023'; end if;
  select * into i from private.hire_bank_invoices where id=p_invoice for update;
  if not found or i.invoice_number is null or i.held_at is not null or i.amount_ore is distinct from p_amount_ore then
    raise exception 'Kontrollera belopp och fakturastatus.' using errcode='22023';
  end if;
  if i.paid_at is not null then
    if i.payment_reference=p_reference then return; end if;
    raise exception 'Fakturan har redan stämts av.' using errcode='22023';
  end if;
  update private.hire_bank_invoices set paid_at=now(),payment_reference=p_reference where id=p_invoice;
exception when unique_violation then raise exception 'Bankreferensen har redan använts.' using errcode='22023';
end;
$$;
revoke all on function public.list_hire_bank_invoices(boolean),public.record_hire_bank_payment(uuid,integer,text)
from public, anon, authenticated, service_role;
grant execute on function public.list_hire_bank_invoices(boolean),public.record_hire_bank_payment(uuid,integer,text) to authenticated;

create function public.validate_hire_bank_invoice_mail_token(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select length(p_token)=64 and private.hire_bank_invoice_config() is not null and exists (
    select 1 from vault.decrypted_secrets where name='mnw_hire_invoice_mail_token' and decrypted_secret=p_token
  );
$$;

create function public.claim_hire_bank_invoice_mail()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i private.hire_bank_invoices%rowtype;
begin
  if private.hire_bank_invoice_config() is null then return null; end if;
  update private.hire_bank_invoices set mail_state='review',mail_lease=null,mail_lease_until=null
  where mail_state='sending' and mail_lease_until<=now();
  with next_invoice as (
    select id from private.hire_bank_invoices
    where invoice_number is not null and held_at is null and mail_state='pending' and mail_available_at<=now()
    order by mail_available_at,id limit 1 for update skip locked
  )
  update private.hire_bank_invoices b set
    mail_state='sending',mail_attempts=mail_attempts+1,mail_lease=gen_random_uuid(),mail_lease_until=now()+interval '5 minutes'
  from next_invoice where b.id=next_invoice.id returning b.* into i;
  if not found then return null; end if;
  return jsonb_build_object('invoice',private.hire_bank_invoice_document(i),'recipient',i.recipient,'lease',i.mail_lease);
end;
$$;

create function public.hire_bank_invoice_mail_ready(p_invoice uuid,p_lease uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.hire_bank_invoice_config() is not null and exists (
    select 1 from private.hire_bank_invoices where id=p_invoice and held_at is null
    and mail_state='sending' and mail_lease=p_lease and mail_lease_until>now()
  );
$$;

create function public.finish_hire_bank_invoice_mail(p_invoice uuid,p_lease uuid,p_outcome text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome is null or p_outcome not in ('sent','retry','review','cancelled') then
    raise exception 'Invalid invoice mail result' using errcode='22023';
  end if;
  update private.hire_bank_invoices set
     mail_state=case when p_outcome='sent' then 'sent' when p_outcome='retry' and mail_attempts<4 then 'pending' else 'review' end,
     mail_lease=null,mail_lease_until=null,
     mail_available_at=case when p_outcome='retry' then now()+interval '5 minutes'*mail_attempts else mail_available_at end
  where id=p_invoice and mail_state='sending' and mail_lease=p_lease and mail_lease_until>now();
  return found;
end;
$$;

revoke all on function public.validate_hire_bank_invoice_mail_token(text),public.claim_hire_bank_invoice_mail(),
 public.hire_bank_invoice_mail_ready(uuid,uuid),public.finish_hire_bank_invoice_mail(uuid,uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.validate_hire_bank_invoice_mail_token(text),public.claim_hire_bank_invoice_mail(),
 public.hire_bank_invoice_mail_ready(uuid,uuid),public.finish_hire_bank_invoice_mail(uuid,uuid,text) to service_role;

create function private.dispatch_hire_bank_invoice_mail()
returns void language plpgsql security definer set search_path = '' as $$
declare credential text;
begin
  if private.hire_bank_invoice_config() is null or not exists (
    select 1 from private.hire_bank_invoices
    where (invoice_number is not null and held_at is null and mail_state='pending' and mail_available_at<=now())
       or (mail_state='sending' and mail_lease_until<=now())
  ) then return; end if;
  select decrypted_secret into credential from vault.decrypted_secrets where name='mnw_hire_invoice_mail_token';
  if credential is null then return; end if;
  perform net.http_post(url:='https://matchnwork.se/api/internal/hire-invoice-mail',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),
    body:='{}'::jsonb,timeout_milliseconds:=55000);
end;
$$;
revoke all on function private.dispatch_hire_bank_invoice_mail() from public, anon, authenticated, service_role;
select cron.schedule('mnw-hire-bank-invoice-mail','* * * * *','select private.dispatch_hire_bank_invoice_mail()');
