-- A fixed boolean lookup: service_role intentionally receives NO SELECT grant
-- on auth.sessions. The narrow definer stays in the unexposed private schema.
create function private.is_personal_data_session_active(p_subject_id uuid, p_session_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 -- current_user is the function owner here; check the actual caller database
 -- role, never the user-editable request.jwt.claims role value.
 if current_setting('role',true) is distinct from 'service_role' then
  raise exception using errcode='42501',message='Session verification is restricted';
 end if;
 return p_subject_id is not null and p_session_id is not null and exists(
  select 1 from auth.sessions s
  where s.id=p_session_id and s.user_id=p_subject_id
   and (s.not_after is null or s.not_after>statement_timestamp())
 );
end;
$$;
revoke all on function private.is_personal_data_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function private.is_personal_data_session_active(uuid,uuid) to service_role;

create function public.is_personal_data_session_active(p_subject_id uuid, p_session_id uuid)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if current_user <> 'service_role' then
  raise exception using errcode='42501',message='Session verification is restricted';
 end if;
 return private.is_personal_data_session_active(p_subject_id,p_session_id);
end;
$$;
revoke all on function public.is_personal_data_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.is_personal_data_session_active(uuid,uuid) to service_role;
comment on function public.is_personal_data_session_active(uuid,uuid) is
 'Service-only boolean session ownership/revocation lookup; caller must first verify the request token signature and identity.';
