-- Private case files and access records share the case's transactional purge.
create table private.privacy_case_attachments (
  case_id uuid not null references private.privacy_cases(id) on delete cascade,
  id uuid not null,
  content bytea not null check (
    octet_length(content) between 5 and 1048576 and substring(content from 1 for 5)=decode('255044462d','hex')
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key(case_id,id)
);
create table private.privacy_case_attachment_access (
  id bigint generated always as identity primary key,
  case_id uuid not null,
  attachment_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('upload','download')),
  created_at timestamptz not null default statement_timestamp(),
  foreign key(case_id,attachment_id) references private.privacy_case_attachments(case_id,id) on delete cascade
);
create index on private.privacy_case_attachment_access(case_id,attachment_id);
alter table private.privacy_case_attachments enable row level security;
alter table private.privacy_case_attachment_access enable row level security;
revoke all on private.privacy_case_attachments,private.privacy_case_attachment_access from public,anon,authenticated;
grant select,insert on private.privacy_case_attachments to service_role;
grant insert on private.privacy_case_attachment_access to service_role;
grant usage on sequence private.privacy_case_attachment_access_id_seq to service_role;

create function public.manage_privacy_case_attachment(
  p_actor uuid,p_session uuid,p_case uuid,p_revision uuid,p_action text,p_attachment uuid default null,p_content text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_case private.privacy_cases;
declare item private.privacy_case_attachments;
declare bytes bytea;
begin
  if p_actor is null or p_session is null or not public.is_personal_data_session_active(p_actor,p_session)
    or not private.privacy_case_handler_allowed(p_actor) then
    raise exception 'Denied' using errcode='42501';
  end if;
  if p_case is null or p_revision is null or p_action is null or p_action not in ('list','upload','download')
    or (p_action='list') <> (p_attachment is null) or (p_action='upload') <> (p_content is not null) then
    raise exception 'Invalid attachment request' using errcode='22023';
  end if;
  -- The row lock serializes attachment operations with case changes and purge.
  select * into current_case from private.privacy_cases where id=p_case for update;
  if not found then raise exception 'Not found' using errcode='PT404'; end if;
  if current_case.revision<>p_revision then raise exception 'Stale case' using errcode='PT409'; end if;

  if p_action='list' then
    return jsonb_build_object('caseId',p_case,'revision',p_revision,'files',
      coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'size',octet_length(a.content),'createdAt',a.created_at)
        order by a.created_at,a.id) from private.privacy_case_attachments a where a.case_id=p_case),'[]'::jsonb));
  end if;
  select * into item from private.privacy_case_attachments where case_id=p_case and id=p_attachment;
  if p_action='upload' then
    if current_case.status<>'in_progress' or current_case.assigned_to is distinct from p_actor then
      raise exception 'Case must be assigned and in progress' using errcode='42501';
    end if;
    if length(p_content)>1398104 then raise exception 'File too large' using errcode='22023'; end if;
    bytes:=decode(p_content,'base64');
    if octet_length(bytes) not between 5 and 1048576 or substring(bytes from 1 for 5)<>decode('255044462d','hex') then
      raise exception 'Invalid PDF' using errcode='22023';
    end if;
    if item.id is not null then
      if item.content<>bytes then raise exception 'Attachment ID already used' using errcode='PT409'; end if;
    else
      if (select count(*) from private.privacy_case_attachments where case_id=p_case)>=8 then
        raise exception 'Attachment limit reached' using errcode='PT429';
      end if;
      insert into private.privacy_case_attachments(case_id,id,content) values(p_case,p_attachment,bytes) returning * into item;
      insert into private.privacy_case_attachment_access(case_id,attachment_id,actor_id,action) values(p_case,p_attachment,p_actor,'upload');
    end if;
    return jsonb_build_object('caseId',p_case,'revision',p_revision,'id',item.id);
  end if;
  if item.id is null then raise exception 'Not found' using errcode='PT404'; end if;
  insert into private.privacy_case_attachment_access(case_id,attachment_id,actor_id,action) values(p_case,p_attachment,p_actor,'download');
  return jsonb_build_object('caseId',p_case,'revision',p_revision,'id',item.id,'content',replace(encode(item.content,'base64'),chr(10),''));
end $$;
revoke all on function public.manage_privacy_case_attachment(uuid,uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.manage_privacy_case_attachment(uuid,uuid,uuid,uuid,text,uuid,text) to service_role;
notify pgrst, 'reload schema';
