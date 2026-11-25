-- Youth terms and the application's optional AI choice are separate records.
create table private.youth_terms_versions (
  version text primary key check (length(version) between 1 and 80),
  terms_text text not null check (length(btrim(terms_text)) between 1 and 100000),
  effective_at timestamptz not null unique
);
create table private.youth_terms_acceptances (
  youth_user_id uuid not null references public.youth_profiles(user_id) on delete cascade,
  version text not null references private.youth_terms_versions(version),
  accepted_at timestamptz not null default statement_timestamp(),
  primary key (youth_user_id,version)
);
alter table private.youth_terms_versions enable row level security;
alter table private.youth_terms_acceptances enable row level security;
revoke all on private.youth_terms_versions, private.youth_terms_acceptances from public, anon, authenticated, service_role;
create trigger protect_youth_terms_versions before update or delete
on private.youth_terms_versions for each row execute function private.prevent_company_agreement_rewrite();

create function private.current_youth_terms()
returns text language sql stable security definer set search_path='' as $$
  select version from private.youth_terms_versions
  where effective_at <= statement_timestamp() order by effective_at desc limit 1
$$;

create function public.get_my_youth_terms()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_youth_account(actor) then raise insufficient_privilege; end if;
  return (
    select jsonb_build_object('version',v.version,'terms',v.terms_text,'acceptedAt',a.accepted_at)
    from private.youth_terms_versions v
    left join private.youth_terms_acceptances a on a.version=v.version and a.youth_user_id=actor
    where v.version=private.current_youth_terms()
  );
end $$;

create function public.accept_my_youth_terms(p_version text, p_accepted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); confirmed_at timestamptz;
begin
  if actor is null or not public.is_youth_account(actor) then raise insufficient_privilege; end if;
  if p_version is null or p_version is distinct from private.current_youth_terms() then
    raise exception 'Terms version changed' using errcode='40001';
  end if;
  if p_accepted is distinct from true then
    raise exception 'The terms must be explicitly accepted' using errcode='22023';
  end if;
  insert into private.youth_terms_acceptances(youth_user_id,version) values(actor,p_version)
  on conflict do nothing;
  select accepted_at into confirmed_at from private.youth_terms_acceptances where youth_user_id=actor and version=p_version;
  return jsonb_build_object('version',p_version,'acceptedAt',confirmed_at);
end $$;

create function private.require_youth_terms_for_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare active_version text;
begin
  if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from new.status) then
    active_version:=private.current_youth_terms();
    if active_version is not null and not exists (
      select 1 from private.youth_terms_acceptances
      where youth_user_id=new.youth_user_id and version=active_version
    ) then
      raise exception 'Accept the current youth terms before applying' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger l15_require_youth_terms_for_application before insert or update of status
on public.application_completions for each row execute function private.require_youth_terms_for_application();
revoke all on function private.current_youth_terms(), private.require_youth_terms_for_application() from public, anon, authenticated;
revoke all on function public.get_my_youth_terms(), public.accept_my_youth_terms(text,boolean) from public, anon;
grant execute on function public.get_my_youth_terms(), public.accept_my_youth_terms(text,boolean) to authenticated;

notify pgrst, 'reload schema';
