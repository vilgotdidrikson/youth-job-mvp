create table private.privacy_case_deliveries (
  case_id uuid primary key references private.privacy_cases(id) on delete cascade,
  attachment_id uuid not null,
  requester_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (statement_timestamp()+interval '1 hour'),
  foreign key(case_id,attachment_id) references private.privacy_case_attachments(case_id,id) on delete cascade
);
alter table private.privacy_case_deliveries enable row level security;
revoke all on private.privacy_case_deliveries from public,anon,authenticated;
grant select,insert,update on private.privacy_case_deliveries to service_role;
grant delete on private.privacy_case_attachments to service_role;

create function public.publish_reviewed_privacy_case_delivery(
  p_actor uuid,p_session uuid,p_case uuid,p_revision uuid,p_attachment uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases;
declare previous private.privacy_case_deliveries;
begin
  if p_actor is null or p_session is null or not public.is_personal_data_session_active(p_actor,p_session)
    or not private.privacy_case_handler_allowed(p_actor) then raise exception 'Denied' using errcode='42501'; end if;
  select * into c from private.privacy_cases where id=p_case for update;
  if not found or c.requester_id is null or c.intake_source<>'portal' or c.kind not in ('access','portability')
    or c.assigned_to is distinct from p_actor or c.status<>'in_progress' then raise exception 'Denied' using errcode='42501'; end if;
  if c.revision is distinct from p_revision then raise exception 'Stale case' using errcode='PT409'; end if;
  if not exists(select 1 from private.privacy_case_attachments where case_id=p_case and id=p_attachment) then
    raise exception 'Not found' using errcode='PT404';
  end if;
  select * into previous from private.privacy_case_deliveries where case_id=p_case;
  if previous.attachment_id=p_attachment and previous.expires_at<=statement_timestamp() then
    raise exception 'Upload a new reviewed export' using errcode='PT409';
  end if;
  insert into private.privacy_case_deliveries(case_id,attachment_id,requester_id)
    values(p_case,p_attachment,c.requester_id)
    on conflict(case_id) do update
      set attachment_id=excluded.attachment_id,requester_id=excluded.requester_id,expires_at=excluded.expires_at
      where privacy_case_deliveries.attachment_id<>excluded.attachment_id;
  if previous.attachment_id is distinct from p_attachment and previous.attachment_id is not null then
    delete from private.privacy_case_attachments where case_id=p_case and id=previous.attachment_id;
  end if;
  return jsonb_build_object('caseId',p_case,'revision',p_revision,'id',p_attachment);
end $$;

create function public.read_reviewed_privacy_case_delivery(p_subject uuid,p_session uuid,p_case uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare payload jsonb;
declare file_id uuid;
begin
  if p_subject is null or p_session is null or not public.is_personal_data_session_active(p_subject,p_session) then
    raise exception 'Denied' using errcode='42501';
  end if;
  select jsonb_build_object('caseId',c.id,'content',replace(encode(a.content,'base64'),chr(10),''))
    ,a.id into payload,file_id from private.privacy_case_deliveries d
    join private.privacy_cases c on c.id=d.case_id and c.requester_id=d.requester_id
    join private.privacy_case_attachments a on a.case_id=d.case_id and a.id=d.attachment_id
    where d.case_id=p_case and d.requester_id=p_subject and d.expires_at>statement_timestamp();
  if payload is null then raise exception 'Not found' using errcode='PT404'; end if;
  insert into private.privacy_case_attachment_access(case_id,attachment_id,actor_id,action) values(p_case,file_id,p_subject,'download');
  return payload;
end $$;
revoke all on function public.publish_reviewed_privacy_case_delivery(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.read_reviewed_privacy_case_delivery(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.publish_reviewed_privacy_case_delivery(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.read_reviewed_privacy_case_delivery(uuid,uuid,uuid) to service_role;


create function public.revoke_reviewed_privacy_case_delivery(
  p_actor uuid,p_session uuid,p_case uuid,p_revision uuid,p_attachment uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.privacy_cases;
begin
  if p_actor is null or p_session is null or not public.is_personal_data_session_active(p_actor,p_session)
    or not private.privacy_case_handler_allowed(p_actor) then raise exception 'Denied' using errcode='42501'; end if;
  select * into c from private.privacy_cases where id=p_case for update;
  if not found or c.assigned_to is distinct from p_actor then raise exception 'Denied' using errcode='42501'; end if;
  if c.revision is distinct from p_revision then raise exception 'Stale case' using errcode='PT409'; end if;
  update private.privacy_case_deliveries set expires_at=statement_timestamp()
    where case_id=p_case and attachment_id=p_attachment and expires_at>statement_timestamp();
  return jsonb_build_object('caseId',p_case,'revision',p_revision,'id',p_attachment);
end $$;
revoke all on function public.revoke_reviewed_privacy_case_delivery(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_reviewed_privacy_case_delivery(uuid,uuid,uuid,uuid,uuid) to service_role;

-- Export copies are temporary. The handler must upload a dedicated review copy.
create function private.cleanup_reviewed_privacy_case_deliveries()
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  -- Match the same case-first lock order as publishing or revocation.
  with eligible as materialized (
    select c.id from private.privacy_cases c join private.privacy_case_deliveries d on d.case_id=c.id
    where d.expires_at<=statement_timestamp() order by c.id for update of c skip locked
  )
  delete from private.privacy_case_attachments a using private.privacy_case_deliveries d, eligible e
    where a.case_id=e.id and a.case_id=d.case_id and a.id=d.attachment_id and d.expires_at<=statement_timestamp();
  get diagnostics removed=row_count;
  return removed;
end $$;
revoke all on function private.cleanup_reviewed_privacy_case_deliveries() from public,anon,authenticated;
grant execute on function private.cleanup_reviewed_privacy_case_deliveries() to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('mnw-reviewed-case-delivery-cleanup','*/5 * * * *',
      'select private.cleanup_reviewed_privacy_case_deliveries()');
  end if;
end $$;
notify pgrst, 'reload schema';
