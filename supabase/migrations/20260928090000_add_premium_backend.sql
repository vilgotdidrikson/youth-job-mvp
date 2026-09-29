-- Phase 5: premium entitlements, intentionally independent of payment and invoicing.
-- Only server-side service-role calls may grant or end premium access.

create table public.premium_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('job_boost')),
  scope text not null check (scope in ('job')),
  default_duration interval not null check (default_duration > interval '0'),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This is the premium fulfilment record, not a payment or invoice record.
create table public.premium_orders (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid references auth.users(id) on delete set null,
  product_id uuid not null references public.premium_products(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'activated', 'cancelled')),
  source text not null check (source in ('manual', 'invoice', 'migration')),
  source_reference text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  check (
    (status = 'pending' and activated_at is null and cancelled_at is null)
    or (status = 'activated' and activated_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create unique index premium_orders_source_reference_unique
  on public.premium_orders (source, source_reference)
  where source_reference is not null;

create table public.premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.premium_orders(id) on delete restrict,
  company_user_id uuid references auth.users(id) on delete set null,
  product_id uuid not null references public.premium_products(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  state text not null default 'pending' check (state in ('pending', 'active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  activated_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  created_by_source text not null check (created_by_source in ('manual', 'invoice', 'migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (state in ('pending', 'active', 'expired') and ended_at is null)
    or (state = 'cancelled' and ended_at is not null)
  )
);

create index premium_entitlements_job_window_idx
  on public.premium_entitlements (job_id, starts_at, ends_at)
  where state <> 'cancelled';

create index premium_entitlements_company_state_idx
  on public.premium_entitlements (company_user_id, state);

create table public.premium_activation_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  action text not null check (action in ('activate', 'end')),
  order_id uuid references public.premium_orders(id) on delete set null,
  entitlement_id uuid references public.premium_entitlements(id) on delete set null,
  source text not null check (source in ('manual', 'invoice', 'migration')),
  source_reference text,
  result text not null check (result in ('created', 'replayed', 'ended')),
  created_at timestamptz not null default now()
);

alter table public.premium_products enable row level security;
alter table public.premium_orders enable row level security;
alter table public.premium_entitlements enable row level security;
alter table public.premium_activation_events enable row level security;

create policy "premium orders company own select"
  on public.premium_orders for select
  using (
    company_user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  );

create policy "premium entitlements company own select"
  on public.premium_entitlements for select
  using (
    company_user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  );

-- Initial operational product. It contains no price; pricing belongs to the later
-- invoicing phase. Product changes are service-role/migration-only.
insert into public.premium_products (code, name, kind, scope, default_duration)
values ('job_boost_7d', 'Jobbboost i 7 dagar', 'job_boost', 'job', interval '7 days')
on conflict (code) do nothing;

create or replace function public.premium_effective_boosts(p_job_ids uuid[])
returns table (job_id uuid, is_boosted boolean)
language sql
stable
security definer
set search_path = public
as $$
  select job.id,
    exists (
      select 1
      from public.premium_entitlements entitlement
      join public.premium_products product on product.id = entitlement.product_id
      where entitlement.job_id = job.id
        and entitlement.state <> 'cancelled'
        and product.kind = 'job_boost'
        and entitlement.starts_at <= now()
        and entitlement.ends_at > now()
    ) as is_boosted
  from public.jobs job
  where job.id = any(coalesce(p_job_ids, '{}'::uuid[]))
    and (job.is_active = true or job.company_user_id = auth.uid());
$$;

revoke all on function public.premium_effective_boosts(uuid[]) from public;
grant execute on function public.premium_effective_boosts(uuid[]) to anon, authenticated, service_role;

create or replace function public.activate_premium(
  p_company_user_id uuid,
  p_product_code text,
  p_job_id uuid,
  p_starts_at timestamptz,
  p_source text,
  p_source_reference text,
  p_idempotency_key uuid
)
returns table (order_id uuid, entitlement_id uuid, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.premium_products%rowtype;
  existing_event public.premium_activation_events%rowtype;
  existing_order public.premium_orders%rowtype;
  target_job public.jobs%rowtype;
  requested_start timestamptz;
  effective_start timestamptz;
  latest_end timestamptz;
  created_order_id uuid;
  created_entitlement_id uuid;
  entitlement_state text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Premium activation requires service role' using errcode = '42501';
  end if;

  if p_company_user_id is null or p_job_id is null or p_idempotency_key is null then
    raise exception 'Company, job and idempotency key are required' using errcode = '22023';
  end if;
  if p_source not in ('manual', 'invoice', 'migration') then
    raise exception 'Invalid premium source' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_source_reference, '')), '') is null then
    raise exception 'Premium source reference is required' using errcode = '22023';
  end if;

  -- Serialize retries for both forms of idempotency before checking rows.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || btrim(p_source_reference), 0));

  select * into existing_event
  from public.premium_activation_events
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_event.action <> 'activate' then
      raise exception 'Idempotency key is already used for another action' using errcode = '23505';
    end if;
    return query select existing_event.order_id, existing_event.entitlement_id, 'replayed'::text;
    return;
  end if;

  select * into existing_order
  from public.premium_orders
  where source = p_source and source_reference = btrim(p_source_reference)
  for update;

  if found then
    select entitlement.id into created_entitlement_id
    from public.premium_entitlements entitlement
    where entitlement.order_id = existing_order.id;

    if created_entitlement_id is null then
      raise exception 'Existing premium order has no entitlement' using errcode = '23514';
    end if;

    insert into public.premium_activation_events (
      idempotency_key, action, order_id, entitlement_id, source, source_reference, result
    ) values (
      p_idempotency_key, 'activate', existing_order.id, created_entitlement_id,
      p_source, btrim(p_source_reference), 'replayed'
    );

    return query select existing_order.id, created_entitlement_id, 'replayed'::text;
    return;
  end if;

  select * into product_row
  from public.premium_products
  where code = p_product_code and active = true
  for share;

  if not found or product_row.kind <> 'job_boost' or product_row.scope <> 'job' then
    raise exception 'Unknown or inactive premium product' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_company_user_id and role = 'company'
  ) then
    raise exception 'Premium can only be granted to a company account' using errcode = '42501';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id and company_user_id = p_company_user_id
  for update;

  if not found or target_job.job_kind <> 'employment' then
    raise exception 'Premium target must be an owned employment job' using errcode = '42501';
  end if;
  if target_job.status = 'closed' then
    raise exception 'Premium cannot be granted to a closed job' using errcode = '23514';
  end if;

  requested_start := greatest(coalesce(p_starts_at, now()), now());

  -- Separate boosts queue behind an existing pending or active boost, so an
  -- overlap never consumes two periods while yielding only one visual effect.
  select max(entitlement.ends_at) into latest_end
  from public.premium_entitlements entitlement
  join public.premium_products product on product.id = entitlement.product_id
  where entitlement.job_id = p_job_id
    and entitlement.state <> 'cancelled'
    and product.kind = 'job_boost'
    and entitlement.ends_at > now();

  effective_start := greatest(requested_start, coalesce(latest_end, requested_start));
  entitlement_state := case
    when target_job.status = 'paused' or effective_start > now() then 'pending'
    else 'active'
  end;

  insert into public.premium_orders (
    company_user_id, product_id, job_id, status, source, source_reference,
    idempotency_key, activated_at
  ) values (
    p_company_user_id, product_row.id, p_job_id, 'activated', p_source,
    btrim(p_source_reference), p_idempotency_key, now()
  ) returning id into created_order_id;

  insert into public.premium_entitlements (
    order_id, company_user_id, product_id, job_id, state, starts_at, ends_at,
    created_by_source
  ) values (
    created_order_id, p_company_user_id, product_row.id, p_job_id,
    entitlement_state, effective_start, effective_start + product_row.default_duration,
    p_source
  ) returning id into created_entitlement_id;

  insert into public.premium_activation_events (
    idempotency_key, action, order_id, entitlement_id, source, source_reference, result
  ) values (
    p_idempotency_key, 'activate', created_order_id, created_entitlement_id,
    p_source, btrim(p_source_reference), 'created'
  );

  return query select created_order_id, created_entitlement_id, 'created'::text;
end;
$$;

revoke all on function public.activate_premium(uuid, text, uuid, timestamptz, text, text, uuid) from public;
grant execute on function public.activate_premium(uuid, text, uuid, timestamptz, text, text, uuid) to service_role;

create or replace function public.end_premium(
  p_entitlement_id uuid,
  p_reason text,
  p_source text,
  p_source_reference text,
  p_idempotency_key uuid
)
returns table (entitlement_id uuid, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_event public.premium_activation_events%rowtype;
  entitlement_row public.premium_entitlements%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Premium ending requires service role' using errcode = '42501';
  end if;
  if p_entitlement_id is null or p_idempotency_key is null then
    raise exception 'Entitlement and idempotency key are required' using errcode = '22023';
  end if;
  if p_source not in ('manual', 'invoice', 'migration') then
    raise exception 'Invalid premium source' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or nullif(btrim(coalesce(p_source_reference, '')), '') is null then
    raise exception 'Premium ending reason and source reference are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into existing_event
  from public.premium_activation_events
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_event.action <> 'end' or existing_event.entitlement_id <> p_entitlement_id then
      raise exception 'Idempotency key is already used for another action' using errcode = '23505';
    end if;
    return query select existing_event.entitlement_id, 'replayed'::text;
    return;
  end if;

  select * into entitlement_row
  from public.premium_entitlements
  where id = p_entitlement_id
  for update;

  if not found then
    raise exception 'Premium entitlement not found' using errcode = 'P0002';
  end if;

  if entitlement_row.state <> 'cancelled' then
    update public.premium_entitlements
    set state = 'cancelled', ended_at = now(), end_reason = btrim(p_reason), updated_at = now()
    where id = p_entitlement_id;

    update public.premium_orders
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = btrim(p_reason)
    where id = entitlement_row.order_id and status <> 'cancelled';
  end if;

  insert into public.premium_activation_events (
    idempotency_key, action, order_id, entitlement_id, source, source_reference, result
  ) values (
    p_idempotency_key, 'end', entitlement_row.order_id, p_entitlement_id,
    p_source, btrim(p_source_reference), 'ended'
  );

  return query select p_entitlement_id, 'ended'::text;
end;
$$;

revoke all on function public.end_premium(uuid, text, text, text, uuid) from public;
grant execute on function public.end_premium(uuid, text, text, text, uuid) to service_role;

-- Preserve historical premium rows while ensuring a deleted job can never
-- retain a discoverable entitlement.
create or replace function public.cancel_premium_for_deleted_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.premium_entitlements
  set state = 'cancelled',
      ended_at = now(),
      end_reason = 'job_deleted',
      updated_at = now()
  where job_id = old.id and state <> 'cancelled';

  update public.premium_orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'job_deleted'
  where job_id = old.id and status <> 'cancelled';

  return old;
end;
$$;

drop trigger if exists jobs_cancel_premium_before_delete on public.jobs;
create trigger jobs_cancel_premium_before_delete
  before delete on public.jobs
  for each row execute function public.cancel_premium_for_deleted_job();
