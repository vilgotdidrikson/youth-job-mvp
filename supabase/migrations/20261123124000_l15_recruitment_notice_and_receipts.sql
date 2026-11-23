create table private.company_recruitment_notices (
  company_user_id uuid primary key references public.company_profiles(user_id) on delete cascade,
  contact_email text not null,
  link text,
  details jsonb
);
alter table private.company_recruitment_notices enable row level security;
revoke all on private.company_recruitment_notices from public, anon, authenticated, service_role;

create function public.save_my_company_recruitment_notice(p_contact text, p_link text, p_details jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); field text; contact text:=btrim(p_contact); link text:=nullif(btrim(p_link),'');
begin
  if actor is null or not public.is_company_account(actor) then raise insufficient_privilege; end if;
  if contact is null or length(contact)>254 or contact !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' then
    raise exception 'Invalid recruitment contact email' using errcode='22023';
  end if;
  if link is not null then
    if length(link)>2048 or link !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}([/?#][^[:space:]<>]*)?$'
      or strpos(link,chr(92))>0 or link ~ '[[:cntrl:]]' or p_details is not null then
      raise exception 'Invalid recruitment notice link' using errcode='22023';
    end if;
  else
    if jsonb_typeof(p_details) is distinct from 'object' or octet_length(p_details::text)>24000 then
      raise exception 'Invalid recruitment notice template' using errcode='22023';
    end if;
    foreach field in array array['purpose','basis','recipients','transfers','retention','rights'] loop
      if jsonb_typeof(p_details->field) is distinct from 'string'
        or length(btrim(p_details->>field)) not between 1 and 2500 then
        raise exception 'Incomplete recruitment notice template' using errcode='22023';
      end if;
    end loop;
    if p_details ? 'officer' and (jsonb_typeof(p_details->'officer') is distinct from 'string'
      or length(p_details->>'officer')>2500) then raise invalid_parameter_value; end if;
    if (select count(*) from jsonb_object_keys(p_details))<>(case when p_details ? 'officer' then 7 else 6 end) then
      raise invalid_parameter_value;
    end if;
  end if;
  insert into private.company_recruitment_notices(company_user_id,contact_email,link,details)
  values(actor,contact,link,p_details)
  on conflict(company_user_id) do update set contact_email=excluded.contact_email,link=excluded.link,details=excluded.details;
end $$;

create function public.get_my_company_recruitment_notice()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('contact',contact_email,'link',link,'details',details)
  from private.company_recruitment_notices where company_user_id=auth.uid()
$$;

create function private.read_job_recruitment_notice(p_job uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('company',c.company_name,'organizationNumber',c.organization_number,
    'contact',n.contact_email,'link',n.link,'details',n.details)
  from public.jobs j join public.company_profiles c on c.user_id=j.company_user_id
  join private.company_recruitment_notices n on n.company_user_id=j.company_user_id
  where j.id=p_job and j.status='active' and j.is_active and j.publication_status='published'
    and public.is_verified_company(j.company_user_id) and public.is_youth_account(auth.uid())
    and not public.users_are_blocked(auth.uid(),j.company_user_id)
$$;
create function public.get_job_recruitment_notice(p_job uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.read_job_recruitment_notice(p_job)
  where exists(select 1 from public.jobs where id=p_job)
$$;

-- Keep notice and agreement as independent prerequisites. Before launch there
-- is no effective agreement, so existing accounts keep their current workflow.
create or replace function private.can_use_recruitment_agreement(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.company_has_current_agreement(p_company) and (
    private.current_company_agreement() is null or exists (
      select 1 from private.company_recruitment_notices where company_user_id=p_company
    )
  )
$$;
create or replace function private.require_company_agreement_for_application()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from new.status)
    and exists (select 1 from public.jobs j where j.id=new.job_id
      and not private.can_use_recruitment_agreement(j.company_user_id)) then
    raise exception 'The employer cannot receive applications right now' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.save_my_company_recruitment_notice(text,text,jsonb),
  public.get_my_company_recruitment_notice(), public.get_job_recruitment_notice(uuid),
  private.read_job_recruitment_notice(uuid) from public, anon, authenticated;
grant execute on function public.save_my_company_recruitment_notice(text,text,jsonb),
  public.get_my_company_recruitment_notice(), public.get_job_recruitment_notice(uuid),
  private.read_job_recruitment_notice(uuid) to authenticated;

-- Copy only the evidence kept for a company agreement when the account closes.
-- Agreement text and annex come from the immutable version referenced here.
create table private.closed_company_agreement_receipts (
  former_company_user_id uuid not null,
  version text not null references private.company_agreement_versions(version),
  company_name text not null,
  organization_number text not null,
  representative text not null,
  representative_role text not null,
  accepted_at timestamptz not null,
  ended_at timestamptz not null,
  primary key (former_company_user_id,version)
);
alter table private.closed_company_agreement_receipts enable row level security;
revoke all on private.closed_company_agreement_receipts from public, anon, authenticated, service_role;

create function private.archive_closed_company_agreements()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.closed_company_agreement_receipts
  select company_user_id,version,company_name,organization_number,representative,representative_role,accepted_at,
    statement_timestamp()
  from private.company_agreement_acceptances where company_user_id=old.user_id
  on conflict do nothing;
  return old;
end $$;
create trigger archive_closed_company_agreements before delete on public.company_profiles
for each row execute function private.archive_closed_company_agreements();

-- Kept unscheduled until the retention period is approved.
create function private.purge_closed_company_agreements(p_closed_before timestamptz, p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare purged integer;
begin
  if p_closed_before is null or p_closed_before > statement_timestamp()-interval '3 years' then
    raise invalid_parameter_value;
  end if;
  with expired as (
    select former_company_user_id,version from private.closed_company_agreement_receipts
    where ended_at<=p_closed_before order by ended_at,former_company_user_id,version
    limit greatest(1,least(coalesce(p_limit,100),500)) for update skip locked
  )
  delete from private.closed_company_agreement_receipts r using expired e
  where r.former_company_user_id=e.former_company_user_id and r.version=e.version;
  get diagnostics purged=row_count;
  return purged;
end $$;
revoke all on function private.archive_closed_company_agreements(), private.purge_closed_company_agreements(timestamptz,integer)
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
