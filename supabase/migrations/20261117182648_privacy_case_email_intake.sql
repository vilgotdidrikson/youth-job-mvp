-- Manual transcription only: no mailbox connection, account linking or mail send.
alter table private.privacy_cases add column intake_source text not null default 'portal',add column contact_email text;
alter table private.privacy_cases add constraint privacy_cases_intake_check check(
 (intake_source='portal' and contact_email is null) or
 (intake_source='email' and requester_id is null and contact_email is not null and length(contact_email)<=254 and contact_email=lower(btrim(contact_email)) and contact_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' and contact_email !~ '[\x00-\x1F\x7F]'));
alter table private.privacy_case_events add column external_sent_at timestamptz;
alter table private.privacy_case_events add constraint privacy_case_events_external_check check(external_sent_at is null or (action in ('reply','waiting','close') and public_message is not null and isfinite(external_sent_at)));

create function public.create_email_privacy_case(p_actor uuid,p_session uuid,p_id uuid,p_kind text,p_body text,p_contact_email text,p_received_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases;begin
 if p_actor is null or p_session is null or p_id is null or p_kind is null or p_kind not in ('access','correction','deletion','restriction','objection','portability','other')
 or p_body is null or length(btrim(p_body)) not between 1 and 4000 or p_body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
 or p_contact_email is null or length(p_contact_email)>254 or btrim(p_contact_email) !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' or p_contact_email ~ '[\x00-\x1F\x7F]'
 or p_received_at is null or not isfinite(p_received_at) or p_received_at>statement_timestamp() then raise exception 'Invalid request' using errcode='22023';end if;
 if not private.privacy_case_handler_allowed(p_actor) or not public.is_personal_data_session_active(p_actor,p_session) then raise exception 'Denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy-case-email:'||p_id::text,0));
 select * into c from private.privacy_cases where id=p_id;
 if found then
  if c.intake_source<>'email' or c.kind<>p_kind or c.body<>btrim(p_body) or c.contact_email<>lower(btrim(p_contact_email)) or c.created_at<>p_received_at then raise exception 'Conflict' using errcode='PT409';end if;
  return private.privacy_case_projection(p_id,p_actor);
 end if;
 insert into private.privacy_cases(id,kind,body,created_at,reply_due_at,review_after,intake_source,contact_email)
 values(p_id,p_kind,btrim(p_body),p_received_at,p_received_at+interval '1 month',p_received_at+interval '30 days','email',lower(btrim(p_contact_email)));
 insert into private.privacy_case_events(id,case_id,actor_id,action)values(gen_random_uuid(),p_id,p_actor,'created');
 return private.privacy_case_projection(p_id,p_actor);
end$$;
revoke all on function public.create_email_privacy_case(uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_email_privacy_case(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

-- Replace rather than overload; old portal callers retain the two defaults.
drop function public.update_privacy_case(uuid,uuid,uuid,uuid,uuid,text,text);
create function public.update_privacy_case(p_actor uuid,p_session uuid,p_id uuid,p_revision uuid,p_event uuid,p_action text,p_message text default '',p_external_reply_confirmed boolean default false,p_external_sent_at timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases; old_event private.privacy_case_events;begin
 if p_actor is null or p_session is null or p_id is null or p_revision is null or p_event is null or p_action is null or p_action not in ('claim','reply','waiting','close','reopen')
 or p_message is null or length(p_message)>4000 or p_message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid request' using errcode='22023';end if;
 if not private.privacy_case_handler_allowed(p_actor) or not public.is_personal_data_session_active(p_actor,p_session) then raise exception 'Denied' using errcode='42501';end if;
 select * into c from private.privacy_cases where id=p_id for update;
 if not found then raise exception 'Unavailable' using errcode='PT404';end if;
 if c.intake_source='email' and p_action in ('reply','waiting','close') then
  if p_external_reply_confirmed is distinct from true or p_external_sent_at is null or not isfinite(p_external_sent_at) or p_external_sent_at<c.created_at or p_external_sent_at>statement_timestamp() then raise exception 'Confirm actual external response' using errcode='22023';end if;
 elsif coalesce(p_external_reply_confirmed,false) or p_external_sent_at is not null then raise exception 'Unexpected external response' using errcode='22023';end if;
 select * into old_event from private.privacy_case_events where id=p_event;
 if found then
  if old_event.case_id<>p_id or old_event.actor_id is distinct from p_actor or old_event.action<>p_action or old_event.public_message is distinct from nullif(btrim(p_message),'') or old_event.external_sent_at is distinct from p_external_sent_at then raise exception 'Conflict' using errcode='PT409';end if;
  return private.privacy_case_projection(p_id,p_actor);
 end if;
 if c.revision<>p_revision then raise exception 'Conflict' using errcode='PT409';end if;
 if (c.status='closed' and p_action<>'reopen') or (c.status<>'closed' and p_action='reopen') then raise exception 'Invalid transition' using errcode='PT409';end if;
 if p_action in ('reply','waiting','close') and (c.assigned_to is distinct from p_actor or length(btrim(p_message))<1) then raise exception 'Claim and enter a response' using errcode='22023';end if;
 if p_action in ('claim','reopen') and length(btrim(p_message))>0 then raise exception 'Unexpected message' using errcode='22023';end if;
 update private.privacy_cases set assigned_to=case when p_action in ('claim','reopen') then p_actor else assigned_to end,
 status=case when p_action='close' then 'closed' when p_action='waiting' then 'waiting_for_user' else 'in_progress' end,
 revision=gen_random_uuid(),updated_at=statement_timestamp(),review_after=statement_timestamp()+interval '30 days',
 closed_at=case when p_action='close' then statement_timestamp() else null end,
 retention_until=case when p_action='close' then statement_timestamp()+interval '12 months' else null end where id=p_id;
 insert into private.privacy_case_events(id,case_id,actor_id,action,public_message,external_sent_at)values(p_event,p_id,p_actor,p_action,nullif(btrim(p_message),''),p_external_sent_at);
 return private.privacy_case_projection(p_id,p_actor);
end$$;
revoke all on function public.update_privacy_case(uuid,uuid,uuid,uuid,uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.update_privacy_case(uuid,uuid,uuid,uuid,uuid,text,text,boolean,timestamptz) to service_role;

create or replace function private.privacy_case_projection(p_id uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'requester_id',c.requester_id,'kind',c.kind,'body',c.body,'status',c.status,
 'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at,'reply_due_at',c.reply_due_at,'closed_at',c.closed_at,
 'first_reply_at',case when p_actor is not null then (select min(coalesce(e.external_sent_at,e.created_at)) from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) and e.action in ('reply','waiting','close') and e.public_message is not null) else null end,
 'intake_source',c.intake_source,'contact_email',case when p_actor is not null then c.contact_email else null end,
 'review_after',case when p_actor is not null then c.review_after else null end,
 'assigned',c.assigned_to is not null,'is_mine',coalesce(c.assigned_to=p_actor,false),
 'events',coalesce((select jsonb_agg(e.item order by e.created_at,e.id) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'action',e.action,'public_message',e.public_message,'created_at',e.created_at)||case when p_actor is not null then jsonb_build_object('review_after',e.review_after,'external_sent_at',e.external_sent_at) else '{}'::jsonb end item
   from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) order by e.created_at desc,e.id desc limit 20)e),'[]'::jsonb),
 'events_truncated',(select count(*)>20 from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review'))))
 from private.privacy_cases c where c.id=p_id and (c.intake_source='portal' or p_actor is not null);
$$;
revoke all on function private.privacy_case_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_projection(uuid,uuid) to service_role;


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
  select e.id,e.action,e.public_message,e.created_at,e.review_after,e.external_sent_at from private.privacy_case_events e
  where e.case_id=p_id and (p_admin is not null or e.action not in ('review','schedule_review')) and (e.created_at,e.id)<(p_before,p_before_id)
  order by e.created_at desc,e.id desc limit 21
 ), visible as (
  select * from page order by created_at desc,id desc limit 20
 ) select jsonb_build_object('id',c.id,'revision',c.revision,
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'action',v.action,'public_message',v.public_message,'created_at',v.created_at)||case when p_admin is not null then jsonb_build_object('review_after',v.review_after,'external_sent_at',v.external_sent_at) else '{}'::jsonb end order by v.created_at,v.id) from visible v),'[]'::jsonb),
  'next',case when (select count(*) from page)>20 then (select jsonb_build_object('created_at',v.created_at,'id',v.id) from visible v order by v.created_at,v.id limit 1) else null end
 ) into result;
 return result;
end$$;
revoke all on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.read_privacy_case_history(uuid,uuid,uuid,uuid,uuid,timestamptz,uuid) to service_role;
create or replace function public.list_privacy_case_queue(p_admin uuid,p_session uuid,p_filter text,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_admin is null or p_session is null or p_filter is null or p_filter not in ('all','open','unassigned','mine','waiting','closed','reply_overdue','review_overdue','email')
 or (p_before is null)<>(p_before_id is null) then raise exception 'Invalid scope' using errcode='22023';end if;
 if not public.is_personal_data_session_active(p_admin,p_session) or not private.privacy_case_handler_allowed(p_admin) then raise exception 'Denied' using errcode='42501';end if;
 with page as materialized (
  select c.* from private.privacy_cases c
  where case p_filter when 'all' then true when 'email' then c.intake_source='email' when 'open' then c.status<>'closed'
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

notify pgrst, 'reload schema';
