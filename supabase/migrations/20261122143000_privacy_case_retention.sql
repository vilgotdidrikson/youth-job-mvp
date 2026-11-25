-- Apply only when the reviewed retention workflow is ready. This migration
-- adds no schedule and deletes no records on installation.
create function public.purge_reviewed_privacy_case(
  p_admin uuid,
  p_session uuid,
  p_case uuid,
  p_revision uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_admin is null or p_session is null or
     not public.is_personal_data_session_active(p_admin, p_session) or
     not private.privacy_case_handler_allowed(p_admin) then
    raise exception 'Denied' using errcode = '42501';
  end if;
  if p_case is null or p_revision is null then
    raise exception 'Invalid retention scope' using errcode = '22023';
  end if;

  -- The caller explicitly approves one reviewed revision after checking for
  -- continuing retention needs. Reopening or editing the case invalidates it.
  delete from private.privacy_cases
  where id = p_case and revision = p_revision and status = 'closed'
    and retention_until <= statement_timestamp();

  return found;
end;
$$;

revoke all on function public.purge_reviewed_privacy_case(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.purge_reviewed_privacy_case(uuid, uuid, uuid, uuid)
  to service_role;

-- Show upcoming deadlines across the entire queue, before pagination.
create or replace function public.list_privacy_case_queue(p_admin uuid,p_session uuid,p_filter text,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_admin is null or p_session is null or p_filter is null or p_filter not in ('all','open','unassigned','mine','waiting','closed','reply_overdue','review_overdue','due_soon','email')
 or (p_before is null)<>(p_before_id is null) then raise exception 'Invalid scope' using errcode='22023';end if;
 if not public.is_personal_data_session_active(p_admin,p_session) or not private.privacy_case_handler_allowed(p_admin) then raise exception 'Denied' using errcode='42501';end if;
 with page as materialized (
  select c.* from private.privacy_cases c
  where case p_filter when 'all' then true when 'email' then c.intake_source='email' when 'open' then c.status<>'closed'
   when 'unassigned' then c.status<>'closed' and c.assigned_to is null
   when 'mine' then c.status<>'closed' and c.assigned_to=p_admin
   when 'reply_overdue' then c.status<>'closed' and c.reply_due_at<=statement_timestamp()
   when 'review_overdue' then c.status<>'closed' and c.review_after<=statement_timestamp()
   when 'due_soon' then c.status<>'closed' and (
     (c.reply_due_at > statement_timestamp() and c.reply_due_at <= statement_timestamp() + interval '168 hours') or
     (c.review_after > statement_timestamp() and c.review_after <= statement_timestamp() + interval '168 hours')
   )
   when 'waiting' then c.status='waiting_for_user' when 'closed' then c.status='closed' else false end
  and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
  order by c.created_at desc,c.id desc limit 21
 ), visible as (select * from page order by created_at desc,id desc limit 20)
 select jsonb_build_object('as_of',statement_timestamp(),'available',public.privacy_case_intake_available(),
  'cases',coalesce((select jsonb_agg(private.privacy_case_projection(v.id,p_admin) order by v.created_at desc,v.id desc) from visible v),'[]'::jsonb),
  'next',case when (select count(*) from page)>20 then (select jsonb_build_object('created_at',v.created_at,'id',v.id) from visible v order by v.created_at,v.id limit 1) else null end
 ) into result;
 return result;
end$$;
revoke all on function public.list_privacy_case_queue(uuid,uuid,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.list_privacy_case_queue(uuid,uuid,text,timestamptz,uuid) to service_role;

notify pgrst, 'reload schema';
