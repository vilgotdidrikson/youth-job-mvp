-- Allow shared school/company networks; retries do not consume signup quota.
create or replace function public.register_prelaunch_signup(p_role text, p_name text, p_email text, p_company text, p_consent text, p_bucket text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare request_count integer;
begin
  if p_consent <> 'launch-2026-11-02' then raise exception 'Invalid consent version'; end if;
  -- Retrying an existing signup is success, including unsubscribed contacts.
  -- Never overwrite their details or re-subscribe them.
  if exists (select 1 from public.prelaunch_signups where role = p_role and email = lower(btrim(p_email))) then return true; end if;
  delete from public.prelaunch_rate_limits where window_start < now() - interval '30 minutes';
  insert into public.prelaunch_rate_limits (bucket, window_start, attempts) values (p_bucket, now(), 1)
  on conflict (bucket) do update set attempts = public.prelaunch_rate_limits.attempts + 1
  returning attempts into request_count;
  if request_count > 120 then return false; end if;
  insert into public.prelaunch_signups (role, name, email, company_name, consent_version)
  values (p_role, btrim(p_name), lower(btrim(p_email)), nullif(btrim(p_company), ''), p_consent)
  on conflict (role, email) do nothing;
  -- Same response for new and existing emails. Never overwrite someone's details or re-subscribe them.
  return true;
end;
$$;
revoke all on function public.register_prelaunch_signup(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_prelaunch_signup(text,text,text,text,text,text) to service_role;
