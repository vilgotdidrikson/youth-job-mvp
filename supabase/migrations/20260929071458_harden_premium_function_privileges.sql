-- Premium mutations are server-side only. The trigger helper is internal.
revoke execute on function public.activate_premium(uuid, text, uuid, timestamptz, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_premium(uuid, text, uuid, timestamptz, text, text, uuid)
  to service_role;

revoke execute on function public.end_premium(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.end_premium(uuid, text, text, text, uuid)
  to service_role;

revoke execute on function public.cancel_premium_for_deleted_job()
  from public, anon, authenticated;