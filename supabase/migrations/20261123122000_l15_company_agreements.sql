-- No agreement is published by this migration. Published versions are append-only.
create table private.company_agreement_versions (
  version text primary key check (length(version) between 1 and 80),
  agreement_text text not null check (length(btrim(agreement_text)) between 1 and 100000),
  annex_text text not null check (length(btrim(annex_text)) between 1 and 100000),
  effective_at timestamptz not null unique
);
create table private.company_agreement_acceptances (
  company_user_id uuid not null references public.company_profiles(user_id) on delete cascade,
  version text not null references private.company_agreement_versions(version),
  company_name text not null,
  organization_number text not null,
  representative text not null,
  representative_role text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  ended_at timestamptz,
  primary key (company_user_id, version)
);
alter table private.company_agreement_versions enable row level security;
alter table private.company_agreement_acceptances enable row level security;
revoke all on private.company_agreement_versions, private.company_agreement_acceptances from public, anon, authenticated, service_role;

create function private.prevent_company_agreement_rewrite()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Publish a new version instead' using errcode='23514';
end $$;
create trigger protect_company_agreement_versions before update or delete
on private.company_agreement_versions for each row execute function private.prevent_company_agreement_rewrite();

create function private.current_company_agreement()
returns text language sql stable security definer set search_path='' as $$
  select version from private.company_agreement_versions
  where effective_at <= statement_timestamp() order by effective_at desc limit 1
$$;

create function private.company_has_current_agreement(p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select v.version is null or exists (
    select 1 from private.company_agreement_acceptances a
    join public.company_profiles c on c.user_id=a.company_user_id
    where a.company_user_id=p_actor and a.version=v.version and a.ended_at is null
      and a.organization_number=replace(c.organization_number,'-','')
  ) from (select private.current_company_agreement() version) v
$$;

create or replace function public.is_verified_company(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles p join public.company_profiles c on c.user_id=p.id
    where p.id=check_user_id and p.role='company' and c.verification_status='verified'
      and private.company_has_current_agreement(p.id)
  );
$$;

create function public.get_my_company_agreement(p_version text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid(); active_version text := private.current_company_agreement();
begin
  if actor is null or not public.is_company_account(actor) then raise insufficient_privilege; end if;
  return (
    select jsonb_build_object('version',v.version,'agreement',v.agreement_text,'annex',v.annex_text,
      'acceptedAt',a.accepted_at,'endedAt',a.ended_at,'representative',a.representative,
      'representativeRole',a.representative_role,'acceptedCompanyName',a.company_name,
      'acceptedOrganizationNumber',a.organization_number,'companyName',c.company_name,
      'organizationNumber',c.organization_number,'currentVersion',active_version,
      'history',coalesce((select jsonb_agg(h.version order by h.accepted_at desc)
        from private.company_agreement_acceptances h where h.company_user_id=actor),'[]'::jsonb))
    from private.company_agreement_versions v
    join public.company_profiles c on c.user_id=actor
    left join private.company_agreement_acceptances a on a.version=v.version and a.company_user_id=actor
    where v.version=coalesce(p_version,active_version) and (p_version is null or a.version is not null)
  );
end $$;

create function public.accept_my_company_agreement(
  p_version text, p_representative text, p_role text, p_agreement boolean, p_authority boolean
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); company public.company_profiles%rowtype; recorded integer;
begin
  if actor is null or not public.is_company_account(actor) or not exists (
    select 1 from auth.users where id=actor and email_confirmed_at is not null
  ) then raise insufficient_privilege; end if;
  if p_version is null or p_version is distinct from private.current_company_agreement() then
    raise exception 'Agreement version changed' using errcode='40001';
  end if;
  if p_agreement is distinct from true or p_authority is distinct from true
    or coalesce(length(btrim(p_representative)),0) not between 1 and 120
    or coalesce(length(btrim(p_role)),0) not between 1 and 120 then
    raise exception 'Both confirmations and representative details are required' using errcode='22023';
  end if;
  select * into company from public.company_profiles where user_id=actor for update;
  if not found or coalesce(btrim(company.company_name),'')='' or company.organization_number is null then
    raise exception 'Complete the company profile first' using errcode='22023';
  end if;
  insert into private.company_agreement_acceptances(
    company_user_id,version,company_name,organization_number,representative,representative_role
  ) values (
    actor,p_version,company.company_name,replace(company.organization_number,'-',''),btrim(p_representative),btrim(p_role)
  ) on conflict do nothing;
  get diagnostics recorded=row_count;
  if recorded=0 and not private.company_has_current_agreement(actor) then
    raise exception 'Existing acceptance is no longer valid' using errcode='42501';
  end if;
  return public.get_my_company_agreement(p_version);
end $$;

create function private.require_company_agreement_for_verification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.verification_status='verified' and not private.company_has_current_agreement(new.user_id) then
    raise exception 'The current company agreement must be accepted first' using errcode='42501';
  end if;
  return new;
end $$;
create trigger l15_company_verification_agreement before update of verification_status
on public.company_profiles for each row
execute function private.require_company_agreement_for_verification();

-- Preserve the existing role when no version has taken effect.
create function private.can_use_recruitment_agreement(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.company_has_current_agreement(p_company)
$$;
revoke all on function private.can_use_recruitment_agreement(uuid) from public, anon, authenticated;
grant execute on function private.can_use_recruitment_agreement(uuid) to authenticated;

create policy "l15 current agreement to see published jobs" on public.jobs as restrictive for select to authenticated
using (company_user_id=(select auth.uid()) or private.can_use_recruitment_agreement(company_user_id));
create policy "l15 current agreement to insert open jobs" on public.jobs as restrictive for insert to authenticated
with check (publication_status <> 'published' or not is_active or status <> 'active'
  or private.can_use_recruitment_agreement(company_user_id));
create policy "l15 current agreement to update open jobs" on public.jobs as restrictive for update to authenticated
with check (publication_status <> 'published' or not is_active or status <> 'active'
  or private.can_use_recruitment_agreement(company_user_id));

create function private.require_company_agreement_for_application()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from new.status)
    and exists (select 1 from public.jobs j where j.id=new.job_id
      and not private.company_has_current_agreement(j.company_user_id)) then
    raise exception 'The employer cannot receive applications right now' using errcode='42501';
  end if;
  return new;
end $$;
create trigger l15_require_agreement_for_application before insert or update of status
on public.application_completions for each row execute function private.require_company_agreement_for_application();
revoke all on function private.require_company_agreement_for_application() from public, anon, authenticated;

revoke all on function private.current_company_agreement(), private.company_has_current_agreement(uuid),
  private.prevent_company_agreement_rewrite(), private.require_company_agreement_for_verification() from public, anon, authenticated;
revoke all on function public.get_my_company_agreement(text),
  public.accept_my_company_agreement(text,text,text,boolean,boolean) from public, anon;
grant execute on function public.get_my_company_agreement(text),
  public.accept_my_company_agreement(text,text,text,boolean,boolean) to authenticated;

CREATE OR REPLACE FUNCTION private.application_analysis_eligible(p_job uuid, p_youth uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select public.application_ai_allowed(p_job,p_youth) and private.application_content_available(p_job,p_youth) and exists(select 1 from public.jobs j
 join public.application_completions a on a.job_id=j.id and a.youth_user_id=p_youth and a.status='submitted'
 join public.swipe_actions s on s.job_id=j.id and s.youth_user_id=p_youth and s.decision='interested'
 join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job and j.status='active' and j.is_active and j.publication_status='published' and public.is_verified_company(j.company_user_id)
 and not public.users_are_blocked(j.company_user_id,p_youth)
 and not exists(select 1 from public.company_interest_actions d where d.job_id=j.id and d.youth_user_id=p_youth and d.decision='skip')
 and not exists(select 1 from public.matches mt where mt.job_id=j.id and mt.youth_user_id=p_youth and mt.status in ('hired','rejected','cancelled')));
$function$;

create function public.get_pending_company_agreements()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare active_version text := private.current_company_agreement();
begin
  if not public.is_admin_account() then raise insufficient_privilege; end if;
  return jsonb_build_object('version',active_version,'receipts',coalesce((
    select jsonb_agg(jsonb_build_object('companyId',a.company_user_id,'representative',a.representative,
      'role',a.representative_role,'acceptedAt',a.accepted_at) order by a.accepted_at)
    from private.company_agreement_acceptances a join public.company_profiles c on c.user_id=a.company_user_id
    where a.version=active_version and c.verification_status in ('pending','rejected')
      and a.ended_at is null and a.organization_number=replace(c.organization_number,'-','')
  ),'[]'::jsonb));
end $$;
revoke all on function public.get_pending_company_agreements() from public, anon;
grant execute on function public.get_pending_company_agreements() to authenticated;

notify pgrst, 'reload schema';
