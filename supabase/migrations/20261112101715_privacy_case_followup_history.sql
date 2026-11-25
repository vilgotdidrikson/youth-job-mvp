-- L16/L13/F20: reuse existing case dates; no new data, grants or scheduler.
create or replace function private.privacy_case_projection(p_id uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'requester_id',c.requester_id,'kind',c.kind,'body',c.body,'status',c.status,
 'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at,'reply_due_at',c.reply_due_at,'closed_at',c.closed_at,
 'review_after',case when p_actor is not null then c.review_after else null end,
 'assigned',c.assigned_to is not null,'is_mine',coalesce(c.assigned_to=p_actor,false),
 'events',coalesce((select jsonb_agg(e.item order by e.created_at,e.id) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'action',e.action,'public_message',e.public_message,'created_at',e.created_at) item
   from private.privacy_case_events e where e.case_id=c.id order by e.created_at desc,e.id desc limit 20)e),'[]'::jsonb),
 'events_truncated',(select count(*)>20 from private.privacy_case_events e where e.case_id=c.id))
 from private.privacy_cases c where c.id=p_id;
$$;
revoke all on function private.privacy_case_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_projection(uuid,uuid) to service_role;

-- Revision and anchor bind every page to the same thread. Both scopes use the
-- original live session; admin additionally passed fresh password/TOTP in the API.
create function public.read_privacy_case_history(
 p_subject uuid,p_admin uuid,p_session uuid,p_id uuid,p_revision uuid,p_before timestamptz,p_before_id uuid
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare c private.privacy_cases; result jsonb;begin
 if (p_subject is null)=(p_admin is null) or p_session is null or p_id is null or p_revision is null or p_before is null or p_before_id is null then
  raise exception 'Invalid scope' using errcode='22023';end if;
 if not public.is_personal_data_session_active(coalesce(p_subject,p_admin),p_session)
 or (p_admin is not null and not private.privacy_case_handler_allowed(p_admin)) then
  raise exception 'Denied' using errcode='42501';end if;
 select * into c from private.privacy_cases where id=p_id;
 if not found or (p_subject is not null and c.requester_id is distinct from p_subject) then
  raise exception 'Unavailable' using errcode='PT404';end if;
 if c.revision<>p_revision then raise exception 'Changed' using errcode='PT409';end if;
 if not exists(select 1 from private.privacy_case_events e where e.case_id=p_id and e.id=p_before_id and e.created_at=p_before) then
  raise exception 'Invalid anchor' using errcode='22023';end if;
 with page as materialized (
  select e.id,e.action,e.public_message,e.created_at from private.privacy_case_events e
  where e.case_id=p_id and (e.created_at,e.id)<(p_before,p_before_id)
  order by e.created_at desc,e.id desc limit 21
 ), visible as (
  select * from page order by created_at desc,id desc limit 20
 ) select jsonb_build_object('id',c.id,'revision',c.revision,
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'action',v.action,'public_message',v.public_message,'created_at',v.created_at) order by v.created_at,v.id) from visible v),'[]'::jsonb),
  'next',case when (select count(*) from page)>20 then (select jsonb_build_object('created_at',v.created_at,'id',v.id) from visible v order by v.created_at,v.id limit 1) else null end
 ) into result;
 return result;
end$$;
revoke all on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) to service_role;
