-- Target: Primary / MatchnWork (iarnopkuoqumictgnqin), never DevStaging.
create table public.prelaunch_signups (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('youth', 'company')),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  company_name text,
  consent_version text not null,
  created_at timestamptz not null default now(),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  unsubscribed_at timestamptz,
  notified_at timestamptz,
  constraint prelaunch_company_required check (role <> 'company' or char_length(btrim(company_name)) between 2 and 150),
  unique (role, email)
);
create index prelaunch_signups_active_idx on public.prelaunch_signups (role, created_at, id) where unsubscribed_at is null;
alter table public.prelaunch_signups enable row level security;
revoke all on public.prelaunch_signups from public, anon, authenticated;
grant select, insert, update, delete on public.prelaunch_signups to service_role;

create table public.prelaunch_rate_limits (
  bucket text primary key check (char_length(bucket) = 64),
  window_start timestamptz not null,
  attempts integer not null default 1
);
create index prelaunch_rate_limits_expiry_idx on public.prelaunch_rate_limits (window_start);
alter table public.prelaunch_rate_limits enable row level security;
revoke all on public.prelaunch_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.prelaunch_rate_limits to service_role;

-- Invoker security, callable only with server credentials. No client can write directly.
create function public.register_prelaunch_signup(p_role text, p_name text, p_email text, p_company text, p_consent text, p_bucket text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare request_count integer;
begin
  if p_consent <> 'launch-2026-11-02' then raise exception 'Invalid consent version'; end if;
  delete from public.prelaunch_rate_limits where window_start < now() - interval '30 minutes';
  insert into public.prelaunch_rate_limits (bucket, window_start, attempts) values (p_bucket, now(), 1)
  on conflict (bucket) do update set attempts = public.prelaunch_rate_limits.attempts + 1
  returning attempts into request_count;
  if request_count > 8 then return false; end if;
  insert into public.prelaunch_signups (role, name, email, company_name, consent_version)
  values (p_role, btrim(p_name), lower(btrim(p_email)), nullif(btrim(p_company), ''), p_consent)
  on conflict (role, email) do nothing;
  -- Same response for new and existing emails. Never overwrite someone's details or re-subscribe them.
  return true;
end;
$$;
revoke all on function public.register_prelaunch_signup(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_prelaunch_signup(text,text,text,text,text,text) to service_role;
