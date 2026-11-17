-- Run against Primary only after applying the migration. All test rows roll back.
begin;
do $$
declare
  test_bucket text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  prefix text := 'signup-regression-' || gen_random_uuid()::text;
  accepted boolean;
  counted integer;
begin
  -- Eight new signups per IP are accepted; the ninth is rejected.
  for i in 1..8 loop
    accepted := public.register_prelaunch_signup('youth', 'Regression Person', prefix || '-' || i || '@example.com', '', 'launch-2026-11-02', test_bucket);
    if accepted is distinct from true then raise exception 'Shared network signup % rejected', i; end if;
  end loop;
  select attempts into counted from public.prelaunch_rate_limits where prelaunch_rate_limits.bucket = test_bucket;
  if counted <> 8 then raise exception 'Incorrect network counter'; end if;
  -- A duplicate succeeds even at the cap, without replacing details or consent.
  update public.prelaunch_signups set unsubscribed_at = now() where email = prefix || '-1@example.com';
  accepted := public.register_prelaunch_signup('youth', 'Do Not Overwrite', upper(prefix || '-1@example.com'), '', 'launch-2026-11-02', test_bucket);
  if accepted is distinct from true then raise exception 'Existing signup retry rejected'; end if;
  if not exists(select 1 from public.prelaunch_signups where email = prefix || '-1@example.com' and name = 'Regression Person' and unsubscribed_at is not null) then raise exception 'Existing signup modified'; end if;
  select attempts into counted from public.prelaunch_rate_limits where prelaunch_rate_limits.bucket = test_bucket;
  if counted <> 8 then raise exception 'Retry consumed quota'; end if;
  -- The anti-abuse limit still rejects new entries at the boundary.
  accepted := public.register_prelaunch_signup('youth', 'Regression Person', prefix || '-blocked@example.com', '', 'launch-2026-11-02', test_bucket);
  if accepted is distinct from false then raise exception 'Network cap not enforced'; end if;
  if exists(select 1 from public.prelaunch_signups where email = prefix || '-blocked@example.com') then raise exception 'Rejected signup was stored'; end if;
  -- The fixed window genuinely expires.
  update public.prelaunch_rate_limits set window_start = now() - interval '31 minutes' where prelaunch_rate_limits.bucket = test_bucket;
  accepted := public.register_prelaunch_signup('company', 'Regression Person', prefix || '-company@example.com', 'Regression Company', 'launch-2026-11-02', test_bucket);
  if accepted is distinct from true then raise exception 'Expired window did not reset'; end if;
end;
$$;
rollback;
