-- L16/L13/F20: no initial handlers, email, attachments, scheduler or production activation.
-- Ordinary API roles cannot read/write these tables or call these service-only RPCs.
create table private.privacy_case_handlers (
 user_id uuid primary key references public.admin_users(user_id) on delete cascade,
 enabled boolean not null default true, created_at timestamptz not null default now()
);
create table private.privacy_cases (
 id uuid primary key,
 requester_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('access','correction','deletion','restriction','objection','portability','other')),
 body text not null check(length(btrim(body)) between 1 and 4000),
 status text not null default 'new' check(status in ('new','in_progress','waiting_for_user','closed')),
 assigned_to uuid references auth.users(id) on delete set null,
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reply_due_at timestamptz not null default (now()+interval '1 month'),
 review_after timestamptz not null default (now()+interval '30 days'),
 closed_at timestamptz, retention_until timestamptz,
 check ((status='closed') = (closed_at is not null)),
 check ((status='closed') = (retention_until is not null))
);
create index privacy_cases_own_page on private.privacy_cases(requester_id,created_at desc,id desc);
create index privacy_cases_admin_page on private.privacy_cases(created_at desc,id desc);
create index privacy_cases_assignee on private.privacy_cases(assigned_to);
create index privacy_cases_retention on private.privacy_cases(retention_until) where retention_until is not null;
create table private.privacy_case_events (
 id uuid primary key, case_id uuid not null references private.privacy_cases(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('created','claim','reply','waiting','close','reopen','user_reply')),
 public_message text check(public_message is null or length(btrim(public_message)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index privacy_case_events_page on private.privacy_case_events(case_id,created_at desc,id desc);
create index privacy_case_events_actor on private.privacy_case_events(actor_id);
alter table private.privacy_case_handlers enable row level security;
alter table private.privacy_cases enable row level security;
alter table private.privacy_case_events enable row level security;
revoke all on private.privacy_case_handlers,private.privacy_cases,private.privacy_case_events from public,anon,authenticated;
grant select,insert,update,delete on private.privacy_case_handlers,private.privacy_cases,private.privacy_case_events to service_role;

create function private.privacy_case_handler_allowed(p_actor uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.privacy_case_handlers h join public.admin_users a on a.user_id=h.user_id
 join auth.users u on u.id=h.user_id
 where h.user_id=p_actor and h.enabled and u.email_confirmed_at is not null
 and exists(select 1 from auth.mfa_factors f where f.user_id=h.user_id and f.factor_type='totp' and f.status='verified'));
$$;
revoke all on function private.privacy_case_handler_allowed(uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_handler_allowed(uuid) to service_role;
create function public.privacy_case_access(p_actor uuid) returns boolean
language sql stable security invoker set search_path='' as $$select private.privacy_case_handler_allowed(p_actor)$$;
revoke all on function public.privacy_case_access(uuid) from public,anon,authenticated;
grant execute on function public.privacy_case_access(uuid) to service_role;
create function public.privacy_case_intake_available() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.privacy_case_handlers h where private.privacy_case_handler_allowed(h.user_id));
$$;
revoke all on function public.privacy_case_intake_available() from public,anon,authenticated;
grant execute on function public.privacy_case_intake_available() to service_role;

create function private.privacy_case_projection(p_id uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'requester_id',c.requester_id,'kind',c.kind,'body',c.body,'status',c.status,
 'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at,'reply_due_at',c.reply_due_at,'closed_at',c.closed_at,
 'assigned',c.assigned_to is not null,'is_mine',coalesce(c.assigned_to=p_actor,false),
 'events',coalesce((select jsonb_agg(e.item order by e.created_at,e.id) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'action',e.action,'public_message',e.public_message,'created_at',e.created_at) item
   from private.privacy_case_events e where e.case_id=c.id order by e.created_at desc,e.id desc limit 20)e),'[]'::jsonb),
 'events_truncated',(select count(*)>20 from private.privacy_case_events e where e.case_id=c.id))
 from private.privacy_cases c where c.id=p_id;
$$;
revoke all on function private.privacy_case_projection(uuid,uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_projection(uuid,uuid) to service_role;

create function public.list_privacy_cases(p_subject uuid,p_admin uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare items jsonb; cursor_row record;begin
 if (p_subject is null) = (p_admin is null) or (p_before is null) <> (p_before_id is null) then raise exception 'Invalid scope' using errcode='22023';end if;
 if p_admin is not null and not private.privacy_case_handler_allowed(p_admin) then raise exception 'Denied' using errcode='42501';end if;
 if p_subject is not null and not exists(select 1 from auth.users where id=p_subject) then raise exception 'Denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(private.privacy_case_projection(c.id,p_admin) order by c.created_at desc,c.id desc),'[]'::jsonb) into items
 from (select c.* from private.privacy_cases c where (p_admin is not null or c.requester_id=p_subject)
 and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id)) order by c.created_at desc,c.id desc limit 20)c;
 select c.created_at,c.id into cursor_row from private.privacy_cases c where (p_admin is not null or c.requester_id=p_subject)
 and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id)) order by c.created_at desc,c.id desc offset 19 limit 1;
 return jsonb_build_object('available',public.privacy_case_intake_available(),'cases',items,'next',
 case when jsonb_array_length(items)=20 then jsonb_build_object('created_at',cursor_row.created_at,'id',cursor_row.id) else null end);
end$$;
revoke all on function public.list_privacy_cases(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.list_privacy_cases(uuid,uuid,timestamptz,uuid) to service_role;

create function public.create_privacy_case(p_subject uuid,p_id uuid,p_kind text,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing private.privacy_cases;begin
 if p_subject is null or p_id is null or p_kind is null or p_body is null or p_kind not in ('access','correction','deletion','restriction','objection','portability','other')
 or length(btrim(p_body)) not between 1 and 4000 or p_body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid request' using errcode='22023';end if;
 if not exists(select 1 from auth.users where id=p_subject) then raise exception 'Denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy-case:'||p_subject::text,0));
 select * into existing from private.privacy_cases where id=p_id;
 if found then
  if existing.requester_id is distinct from p_subject or existing.kind<>p_kind or existing.body<>btrim(p_body) then raise exception 'Conflict' using errcode='PT409';end if;
  return private.privacy_case_projection(p_id,null);
 end if;
 if not public.privacy_case_intake_available() then raise exception 'Intake unavailable' using errcode='PT503';end if;
 if (select count(*) from private.privacy_cases where requester_id=p_subject and created_at>=statement_timestamp()-interval '1 day')>=5 then raise exception 'Too many requests' using errcode='PT429';end if;
 insert into private.privacy_cases(id,requester_id,kind,body) values(p_id,p_subject,p_kind,btrim(p_body));
 insert into private.privacy_case_events(id,case_id,actor_id,action)values(gen_random_uuid(),p_id,p_subject,'created');
 return private.privacy_case_projection(p_id,null);
end$$;
revoke all on function public.create_privacy_case(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_privacy_case(uuid,uuid,text,text) to service_role;

-- Server only: caller must freshly reauthenticate the active actor with password + TOTP.
-- No handler grant is created here. Authenticated/anon roles cannot invoke this with spoofed actor IDs.
create function public.update_privacy_case(p_actor uuid,p_session uuid,p_id uuid,p_revision uuid,p_event uuid,p_action text,p_message text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases; old_event private.privacy_case_events;begin
 if p_actor is null or p_session is null or p_id is null or p_revision is null or p_event is null or p_action is null or p_action not in ('claim','reply','waiting','close','reopen')
 or p_message is null or length(p_message)>4000 or p_message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid request' using errcode='22023';end if;
 if not private.privacy_case_handler_allowed(p_actor) or not public.is_personal_data_session_active(p_actor,p_session) then raise exception 'Denied' using errcode='42501';end if;
 select * into c from private.privacy_cases where id=p_id for update;
 if not found then raise exception 'Unavailable' using errcode='PT404';end if;
 select * into old_event from private.privacy_case_events where id=p_event;
 if found then
  if old_event.case_id<>p_id or old_event.actor_id is distinct from p_actor or old_event.action<>p_action or old_event.public_message is distinct from nullif(btrim(p_message),'') then raise exception 'Conflict' using errcode='PT409';end if;
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
 insert into private.privacy_case_events(id,case_id,actor_id,action,public_message)values(p_event,p_id,p_actor,p_action,nullif(btrim(p_message),''));
 return private.privacy_case_projection(p_id,p_actor);
end$$;
revoke all on function public.update_privacy_case(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_privacy_case(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;

create function public.reply_privacy_case(p_subject uuid,p_id uuid,p_revision uuid,p_event uuid,p_message text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases; e private.privacy_case_events;begin
 if p_subject is null or p_id is null or p_revision is null or p_event is null or p_message is null
 or length(btrim(p_message)) not between 1 and 4000 or p_message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid reply' using errcode='22023';end if;
 select * into c from private.privacy_cases where id=p_id for update;
 if not found or c.requester_id is distinct from p_subject then raise exception 'Unavailable' using errcode='PT404';end if;
 select * into e from private.privacy_case_events where id=p_event;
 if found then
 if e.case_id<>p_id or e.actor_id is distinct from p_subject or e.action<>'user_reply' or e.public_message<>btrim(p_message) then raise exception 'Conflict' using errcode='PT409';end if;
 return private.privacy_case_projection(p_id,null);end if;
 if c.revision<>p_revision or c.status='closed' then raise exception 'Conflict' using errcode='PT409';end if;
 if (select count(*) from private.privacy_case_events where actor_id=p_subject and action='user_reply' and created_at>=statement_timestamp()-interval '1 day')>=20 then raise exception 'Too many replies' using errcode='PT429';end if;
 update private.privacy_cases set status=case when status='waiting_for_user' then 'in_progress' else status end,
 revision=gen_random_uuid(),updated_at=statement_timestamp() where id=p_id;
 insert into private.privacy_case_events(id,case_id,actor_id,action,public_message)values(p_event,p_id,p_subject,'user_reply',btrim(p_message));
 return private.privacy_case_projection(p_id,null);
end$$;
revoke all on function public.reply_privacy_case(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reply_privacy_case(uuid,uuid,uuid,uuid,text) to service_role;
