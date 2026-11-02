-- Server-only lookup; identity/password/session checks stay at the HTTP boundary.
-- No contents, storage paths, hashes or expiry extensions are exposed here.
create index personal_data_exports_subject_latest
on private.personal_data_exports(subject_id,created_at desc,id desc);

create function public.latest_personal_data_export(p_subject_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare job private.personal_data_exports;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_subject_id is null or not exists(select 1 from public.profiles where id=p_subject_id) then
  return jsonb_build_object('status','none');
 end if;
 select * into job from private.personal_data_exports where subject_id=p_subject_id
 order by created_at desc,id desc limit 1;
 if not found then return jsonb_build_object('status','none'); end if;
 if job.expires_at<=statement_timestamp() then return jsonb_build_object('status','expired'); end if;
 if job.status not in ('building','ready') then return jsonb_build_object('status','failed'); end if;
 return jsonb_build_object('status',job.status,'id',job.id,'subjectId',job.subject_id,'expiresAt',job.expires_at);
end;$$;
revoke all on function public.latest_personal_data_export(uuid) from public,anon,authenticated;
grant execute on function public.latest_personal_data_export(uuid) to service_role;
