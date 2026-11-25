-- No content or credentials in this table. No FK: cleanup metadata MUST survive
-- account deletion until Storage has physically removed the corresponding ZIP.
create table private.personal_data_exports (
 id uuid primary key, subject_id uuid not null,
 object_path text generated always as (subject_id::text||'/'||id::text||'.zip') stored,
 status text not null check(status in ('building','ready','failed','deleting')),
 created_at timestamptz not null, expires_at timestamptz not null,
 size_bytes bigint, content_sha256 text,
 lock_token uuid, lease_expires_at timestamptz,
 retry_at timestamptz not null default statement_timestamp(), attempts integer not null default 0 check(attempts>=0),
 check(expires_at=created_at+interval '1 hour'),
 check(size_bytes is null or size_bytes between 1 and 67108864),
 check(content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
 check(status<>'ready' or (size_bytes is not null and content_sha256 is not null))
);
alter table private.personal_data_exports enable row level security;
revoke all on private.personal_data_exports from public,anon,authenticated;
grant select,insert,update,delete on private.personal_data_exports to service_role;
create policy "export worker only" on private.personal_data_exports to service_role using(true) with check(true);
create unique index personal_data_exports_one_active on private.personal_data_exports(subject_id) where status in ('building','ready');
create index personal_data_exports_cleanup on private.personal_data_exports(expires_at,retry_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('personal-data-exports','personal-data-exports',false,67108864,array['application/zip']);
-- Restrictive defense: future permissive policies must not expose this bucket.
create policy "export packages server only" on storage.objects as restrictive
for all to anon,authenticated using(bucket_id<>'personal-data-exports') with check(bucket_id<>'personal-data-exports');

create function public.begin_personal_data_export(p_subject_id uuid,p_export_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job private.personal_data_exports;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_subject_id is null or p_export_id is null or not exists(select 1 from public.profiles where id=p_subject_id) then
  raise exception using errcode='22023',message='Invalid export subject'; end if;
 perform pg_advisory_xact_lock(hashtextextended('personal-data-export:'||p_subject_id::text,0));
 update private.personal_data_exports set status='deleting' where subject_id=p_subject_id and status in ('building','ready') and expires_at<=statement_timestamp();
 select * into job from private.personal_data_exports where subject_id=p_subject_id and status in ('building','ready');
 if found then
  if job.id<>p_export_id or job.status<>'building' then return jsonb_build_object('status','busy'); end if;
 else
  insert into private.personal_data_exports(id,subject_id,status,created_at,expires_at)
  values(p_export_id,p_subject_id,'building',statement_timestamp(),statement_timestamp()+interval '1 hour') returning * into job;
 end if;
 return jsonb_build_object('status','building','id',job.id,'subjectId',job.subject_id,'path',job.object_path,'expiresAt',job.expires_at);
end;$$;

create function public.finish_personal_data_export(p_subject_id uuid,p_export_id uuid,p_success boolean,p_size_bytes bigint default null,p_content_sha256 text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_success is null then raise exception using errcode='22023',message='Invalid export result'; end if;
 if not p_success then
  update private.personal_data_exports set status='failed' where id=p_export_id and subject_id=p_subject_id and status in ('building','ready');
  return found;
 end if;
 if p_size_bytes is null or p_size_bytes not between 1 and 67108864 or p_content_sha256 is null or p_content_sha256 !~ '^[a-f0-9]{64}$' then
  raise exception using errcode='22023',message='Invalid export result'; end if;
 update private.personal_data_exports set status='ready',size_bytes=p_size_bytes,content_sha256=p_content_sha256
 where id=p_export_id and subject_id=p_subject_id and status='building' and expires_at>statement_timestamp()
 and exists(select 1 from public.profiles where id=p_subject_id);
 return found;
end;$$;

create function public.read_personal_data_export(p_subject_id uuid,p_export_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare job private.personal_data_exports;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 select * into job from private.personal_data_exports where id=p_export_id and subject_id=p_subject_id
 and status='ready' and expires_at>statement_timestamp() and exists(select 1 from public.profiles where id=p_subject_id);
 if not found then return jsonb_build_object('status','unavailable'); end if;
 return jsonb_build_object('status','ready','id',job.id,'subjectId',job.subject_id,'path',job.object_path,'expiresAt',job.expires_at,'sizeBytes',job.size_bytes,'sha256',job.content_sha256);
end;$$;

create function public.claim_personal_data_export_cleanup(p_limit integer default 10)
returns setof jsonb language plpgsql security invoker set search_path='' as $$
declare job private.personal_data_exports; lease uuid;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_limit is null or p_limit not between 1 and 20 then raise exception using errcode='22023',message='Invalid cleanup limit'; end if;
 for job in select e.* from private.personal_data_exports e where e.retry_at<=statement_timestamp()
 and (e.lease_expires_at is null or e.lease_expires_at<=statement_timestamp())
 and (e.status in ('failed','deleting') or e.expires_at<=statement_timestamp()
  or (e.status='building' and e.created_at<=statement_timestamp()-interval '10 minutes')
  or not exists(select 1 from public.profiles p where p.id=e.subject_id))
 order by e.expires_at,e.id for update skip locked limit p_limit loop
  lease:=gen_random_uuid();
  update private.personal_data_exports set status='deleting',lock_token=lease,lease_expires_at=statement_timestamp()+interval '5 minutes',attempts=attempts+1 where id=job.id;
  return next jsonb_build_object('id',job.id,'subjectId',job.subject_id,'path',job.object_path,'lockToken',lease);
 end loop;
end;$$;

create function public.finish_personal_data_export_cleanup(p_export_id uuid,p_lock_token uuid,p_success boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_success is null then raise exception using errcode='22023',message='Invalid cleanup result'; end if;
 if p_success then
  delete from private.personal_data_exports where id=p_export_id and status='deleting' and lock_token=p_lock_token and lease_expires_at>statement_timestamp();
 else
  update private.personal_data_exports set lock_token=null,lease_expires_at=null,retry_at=statement_timestamp()+interval '5 minutes'
  where id=p_export_id and status='deleting' and lock_token=p_lock_token and lease_expires_at>statement_timestamp();
 end if;
 return found;
end;$$;

-- A request cancelled by the writer may still finish remotely. Reconcile old
-- untracked objects on EVERY sweep so a late upload cannot escape cleanup just
-- because its earlier job metadata has already been deleted. Never delete the
-- Storage metadata directly; only enqueue the fixed canonical object path.
create function public.reconcile_personal_data_export_orphans(p_limit integer default 20)
returns integer language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Export operation is restricted'; end if;
 if p_limit is null or p_limit not between 1 and 20 then raise exception using errcode='22023',message='Invalid cleanup limit'; end if;
 insert into private.personal_data_exports(id,subject_id,status,created_at,expires_at)
 select replace(split_part(o.name,'/',2),'.zip','')::uuid,split_part(o.name,'/',1)::uuid,'deleting',statement_timestamp()-interval '2 hours',statement_timestamp()-interval '1 hour'
 from (select name from storage.objects where bucket_id='personal-data-exports'
  and name ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}\.zip$'
  and created_at<statement_timestamp()-interval '15 minutes'
  and not exists(select 1 from private.personal_data_exports e where e.object_path=storage.objects.name)
  order by created_at,name limit p_limit) o
 on conflict(id) do nothing;
 get diagnostics total=row_count;
 return total;
end;$$;

revoke all on function public.begin_personal_data_export(uuid,uuid),public.finish_personal_data_export(uuid,uuid,boolean,bigint,text),public.read_personal_data_export(uuid,uuid),public.claim_personal_data_export_cleanup(integer),public.finish_personal_data_export_cleanup(uuid,uuid,boolean),public.reconcile_personal_data_export_orphans(integer) from public,anon,authenticated;
grant execute on function public.begin_personal_data_export(uuid,uuid),public.finish_personal_data_export(uuid,uuid,boolean,bigint,text),public.read_personal_data_export(uuid,uuid),public.claim_personal_data_export_cleanup(integer),public.finish_personal_data_export_cleanup(uuid,uuid,boolean),public.reconcile_personal_data_export_orphans(integer) to service_role;
