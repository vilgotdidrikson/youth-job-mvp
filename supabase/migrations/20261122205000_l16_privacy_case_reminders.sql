-- One generic notice per eligible handler per Stockholm day. No case IDs,
-- identities, subjects, messages, or evidence go to the notification inbox.
create function private.notify_privacy_case_deadlines()
returns integer language plpgsql security definer set search_path='' as $$
declare delivered integer;
begin
  insert into public.notifications(id,user_id,type,title,body,href)
  select md5('privacy-case-deadline:'||h.user_id::text||':'||(statement_timestamp() at time zone 'Europe/Stockholm')::date::text)::uuid,
    h.user_id,'privacy_case_reminder','Dags att följa upp ärendekön',
    'Det finns ett ärende som behöver kontrolleras. Öppna den skyddade ärendevyn.',
    '/admin/privacy-cases'
  from private.privacy_case_handlers h
  where h.enabled and private.privacy_case_handler_allowed(h.user_id) and exists (
    select 1 from private.privacy_cases c
    where c.status<>'closed'
      and (c.assigned_to is null or c.assigned_to=h.user_id
        or not private.privacy_case_handler_allowed(c.assigned_to))
      and (c.review_after<=statement_timestamp()+interval '7 days'
        or c.reply_due_at<=statement_timestamp()+interval '7 days')
  )
  on conflict (id) do nothing;
  get diagnostics delivered=row_count;
  return delivered;
end $$;
revoke all on function private.notify_privacy_case_deadlines() from public,anon,authenticated;
grant execute on function private.notify_privacy_case_deadlines() to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('mnw-privacy-case-deadlines','0 7 * * *','select private.notify_privacy_case_deadlines()');
  end if;
end $$;
