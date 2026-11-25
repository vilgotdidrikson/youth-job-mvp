-- L03: current billing contact/address only. No invoice, price or payment event.
-- Separate table: public company/profile projections must never include this data.
create table public.company_billing_details (
 user_id uuid primary key references public.company_profiles(user_id) on delete cascade,
 invoice_email text not null check (length(invoice_email) between 3 and 254 and invoice_email = lower(btrim(invoice_email)) and invoice_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'),
 address_line1 text not null check (length(btrim(address_line1)) between 1 and 150),
 address_line2 text not null default '' check (length(address_line2) <= 150),
 postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
 city text not null check (length(btrim(city)) between 1 and 100),
 reference text not null default '' check (length(reference) <= 100),
 country_code text not null default 'SE' check (country_code = 'SE'),
 version integer not null default 1 check (version > 0),
 updated_at timestamptz not null default now(),
 check ((invoice_email || address_line1 || address_line2 || city || reference) !~ '[[:cntrl:]]')
);
alter table public.company_billing_details enable row level security;
revoke all on public.company_billing_details from public, anon, authenticated, service_role;
grant select on public.company_billing_details to authenticated;
create policy company_billing_own_read on public.company_billing_details for select to authenticated
 using (user_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role='company'));

-- Privileged writes exist only here to enforce version checks on every client write.
-- The private schema is not exposed by PostgREST; PUBLIC/anon cannot execute.
create function private.save_company_billing_details(p_owner_id uuid, p_expected_version integer, p_details jsonb)
returns setof public.company_billing_details language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 current_row public.company_billing_details%rowtype;
 result_row public.company_billing_details%rowtype;
 normalized jsonb;
 item record;
begin
 if actor is null or p_owner_id is distinct from actor then raise exception 'Billing owner mismatch' using errcode='42501'; end if;
 -- Lock the parent so first inserts, updates and company deletion serialize too.
 perform 1 from public.company_profiles c join public.profiles p on p.id=c.user_id
 where c.user_id=actor and p.role='company' for update of c;
 if not found then raise exception 'Company account required' using errcode='42501'; end if;
 if p_details is null or jsonb_typeof(p_details) <> 'object'
  or not (p_details ?& array['invoice_email','address_line1','address_line2','postal_code','city','reference'])
  or p_details - array['invoice_email','address_line1','address_line2','postal_code','city','reference'] <> '{}'::jsonb
 then raise exception 'Invalid billing fields' using errcode='22023'; end if;
 normalized := '{}'::jsonb;
 for item in select key,value from jsonb_each(p_details) loop
  if jsonb_typeof(item.value) <> 'string' or (item.value #>> '{}') ~ '[[:cntrl:]]' then
   raise exception 'Invalid billing field' using errcode='22023';
  end if;
  normalized := normalized || jsonb_build_object(item.key,btrim(item.value #>> '{}'));
 end loop;
 normalized := normalized || jsonb_build_object('invoice_email',lower(normalized->>'invoice_email'),'postal_code',replace(normalized->>'postal_code',' ',''));
 select * into current_row from public.company_billing_details where user_id=actor for update;
 if found then
  if p_expected_version is distinct from current_row.version then raise exception 'Billing details changed; reload' using errcode='40001'; end if;
  update public.company_billing_details set
   invoice_email=normalized->>'invoice_email',address_line1=normalized->>'address_line1',address_line2=normalized->>'address_line2',
   postal_code=normalized->>'postal_code',city=normalized->>'city',reference=normalized->>'reference',
   version=version+1,updated_at=now()
  where user_id=actor returning * into result_row;
 else
  if p_expected_version is not null then raise exception 'Billing details changed; reload' using errcode='40001'; end if;
  insert into public.company_billing_details(user_id,invoice_email,address_line1,address_line2,postal_code,city,reference)
  values(actor,normalized->>'invoice_email',normalized->>'address_line1',normalized->>'address_line2',normalized->>'postal_code',normalized->>'city',normalized->>'reference') returning * into result_row;
 end if;
 return next result_row;
end $$;
revoke all on function private.save_company_billing_details(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.save_company_billing_details(uuid,integer,jsonb) to authenticated;

create function public.save_company_billing_details(p_owner_id uuid, p_expected_version integer, p_details jsonb)
returns setof public.company_billing_details language sql security invoker set search_path = '' as $$
 select * from private.save_company_billing_details(p_owner_id,p_expected_version,p_details);
$$;
revoke all on function public.save_company_billing_details(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_company_billing_details(uuid,integer,jsonb) to authenticated;
comment on table public.company_billing_details is 'L03 current private Swedish billing details; no invoice history or payment obligation. Deleted with company profile. Include in L13 inventory.';
