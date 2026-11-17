-- Internal review audit only. No external deadline/status/first-response change.
alter table private.privacy_case_events add column review_after timestamptz;
alter table private.privacy_case_events drop constraint privacy_case_events_action_check;
alter table private.privacy_case_events add constraint privacy_case_events_action_check check(action in ('created','claim','reply','waiting','close','reopen','user_reply','review','schedule_review'));
alter table private.privacy_case_events add constraint privacy_case_events_review_check check(
 (action in ('review','schedule_review') and review_after is not null and public_message is null)
 or (action not in ('review','schedule_review') and review_after is null));

create function public.record_privacy_case_review(p_actor uuid,p_session uuid,p_id uuid,p_revision uuid,p_event uuid,p_action text,p_review_after timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases;e private.privacy_case_events;begin
 if p_actor is null or p_session is null or p_id is null or p_revision is null or p_event is null or p_action is null or p_action not in ('review','schedule_review') or p_review_after is null or not isfinite(p_review_after) then raise exception 'Invalid request' using errcode='22023';end if;
 if not private.privacy_case_handler_allowed(p_actor) or not public.is_personal_data_session_active(p_actor,p_session) then raise exception 'Denied' using errcode='42501';end if;
 select * into c from private.privacy_cases where id=p_id for update;
 if not found then raise exception 'Unavailable' using errcode='PT404';end if;
 select * into e from private.privacy_case_events where id=p_event;
 if found then
  if e.case_id<>p_id or e.actor_id is distinct from p_actor or e.action<>p_action or e.review_after is distinct from p_review_after then raise exception 'Conflict' using errcode='PT409';end if;
  return private.privacy_case_projection(p_id,p_actor);
 end if;
 if c.revision<>p_revision or c.status='closed' then raise exception 'Changed' using errcode='PT409';end if;
 if c.assigned_to is distinct from p_actor then raise exception 'Denied' using errcode='42501';end if;
 if p_review_after<=statement_timestamp() or p_review_after>statement_timestamp()+interval '30 days' then raise exception 'Choose a future review within 30 days' using errcode='22023';end if;
 update private.privacy_cases set review_after=p_review_after,revision=gen_random_uuid(),updated_at=statement_timestamp() where id=p_id;
 insert into private.privacy_case_events(id,case_id,actor_id,action,review_after)values(p_event,p_id,p_actor,p_action,p_review_after);
 return private.privacy_case_projection(p_id,p_actor);
end$$;
revoke all on function public.record_privacy_case_review(uuid,uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_privacy_case_review(uuid,uuid,uuid,uuid,uuid,text,timestamptz) to service_role;

-- L16/L13/F20: internal audit dates are visible only to verified handlers.
create or replace function private.privacy_case_projection(p_id uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'requester_id',c.requester_id,'kind',c.kind,'body',c.body,'status',c.status,
 'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at,'reply_due_at',c.reply_due_at,'closed_at',c.closed_at,
 'first_reply_at',case when p_actor is not null then (select min(e.created_at) from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) and e.action in ('reply','waiting','close') and e.public_message is not null) else null end,
 'review_after',case when p_actor is not null then c.review_after else null end,
 'assigned',c.assigned_to is not null,'is_mine',coalesce(c.assigned_to=p_actor,false),
 'events',coalesce((select jsonb_agg(e.item order by e.created_at,e.id) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'action',e.action,'public_message',e.public_message,'created_at',e.created_at)||case when p_actor is not null then jsonb_build_object('review_after',e.review_after) else '{}'::jsonb end item
   from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) order by e.created_at desc,e.id desc limit 20)e),'[]'::jsonb),
 'events_truncated',(select count(*)>20 from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review'))))
 from private.privacy_cases c where c.id=p_id;
$$;
revoke all on function private.privacy_case_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_projection(uuid,uuid) to service_role;


-- Revision and anchor bind every page to the same thread. Both scopes use the
-- original live session; admin additionally passed fresh password/TOTP in the API.
create or replace function public.read_privacy_case_history(
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
 if not exists(select 1 from private.privacy_case_events e where e.case_id=p_id and e.id=p_before_id and e.created_at=p_before and (p_admin is not null or e.action not in ('review','schedule_review'))) then
  raise exception 'Invalid anchor' using errcode='22023';end if;
 with page as materialized (
  select e.id,e.action,e.public_message,e.created_at,e.review_after from private.privacy_case_events e
  where e.case_id=p_id and (p_admin is not null or e.action not in ('review','schedule_review')) and (e.created_at,e.id)<(p_before,p_before_id)
  order by e.created_at desc,e.id desc limit 21
 ), visible as (
  select * from page order by created_at desc,id desc limit 20
 ) select jsonb_build_object('id',c.id,'revision',c.revision,
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'action',v.action,'public_message',v.public_message,'created_at',v.created_at)||case when p_admin is not null then jsonb_build_object('review_after',v.review_after) else '{}'::jsonb end order by v.created_at,v.id) from visible v),'[]'::jsonb),
  'next',case when (select count(*) from page)>20 then (select jsonb_build_object('created_at',v.created_at,'id',v.id) from visible v order by v.created_at,v.id limit 1) else null end
 ) into result;
 return result;
end$$;
revoke all on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) to service_role;
create or replace function public.list_privacy_case_queue(p_admin uuid,p_session uuid,p_filter text,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_admin is null or p_session is null or p_filter is null or p_filter not in ('all','open','unassigned','mine','waiting','closed','reply_overdue','review_overdue')
 or (p_before is null)<>(p_before_id is null) then raise exception 'Invalid scope' using errcode='22023';end if;
 if not public.is_personal_data_session_active(p_admin,p_session) or not private.privacy_case_handler_allowed(p_admin) then raise exception 'Denied' using errcode='42501';end if;
 with page as materialized (
  select c.* from private.privacy_cases c
  where case p_filter when 'all' then true when 'open' then c.status<>'closed'
   when 'unassigned' then c.status<>'closed' and c.assigned_to is null
   when 'mine' then c.status<>'closed' and c.assigned_to=p_admin
   when 'reply_overdue' then c.status<>'closed' and c.reply_due_at<=statement_timestamp()
   when 'review_overdue' then c.status<>'closed' and c.review_after<=statement_timestamp()
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
