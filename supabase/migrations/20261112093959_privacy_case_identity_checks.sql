-- Preserve Auth table grants. Only service_role can use these narrow booleans.
create function private.privacy_case_identity_exists(p_subject uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Restricted boolean lookup' using errcode='42501';end if;
 return exists(select 1 from auth.users where id=p_subject);
end$$;
revoke all on function private.privacy_case_identity_exists(uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_identity_exists(uuid) to service_role;

create or replace function private.privacy_case_handler_allowed(p_actor uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
 begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Restricted boolean lookup' using errcode='42501';end if;
 return exists(select 1 from private.privacy_case_handlers h join public.admin_users a on a.user_id=h.user_id
 join auth.users u on u.id=h.user_id
 where h.user_id=p_actor and h.enabled and u.email_confirmed_at is not null
 and exists(select 1 from auth.mfa_factors f where f.user_id=h.user_id and f.factor_type='totp' and f.status='verified'));
 end$$;
revoke all on function private.privacy_case_handler_allowed(uuid) from public,anon,authenticated;
grant execute on function private.privacy_case_handler_allowed(uuid) to service_role;

create or replace function public.list_privacy_cases(p_subject uuid,p_admin uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare items jsonb; cursor_row record;begin
 if (p_subject is null) = (p_admin is null) or (p_before is null) <> (p_before_id is null) then raise exception 'Invalid scope' using errcode='22023';end if;
 if p_admin is not null and not private.privacy_case_handler_allowed(p_admin) then raise exception 'Denied' using errcode='42501';end if;
 if p_subject is not null and not private.privacy_case_identity_exists(p_subject) then raise exception 'Denied' using errcode='42501';end if;
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

create or replace function public.create_privacy_case(p_subject uuid,p_id uuid,p_kind text,p_body text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing private.privacy_cases;begin
 if p_subject is null or p_id is null or p_kind is null or p_body is null or p_kind not in ('access','correction','deletion','restriction','objection','portability','other')
 or length(btrim(p_body)) not between 1 and 4000 or p_body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid request' using errcode='22023';end if;
 if not private.privacy_case_identity_exists(p_subject) then raise exception 'Denied' using errcode='42501';end if;
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
