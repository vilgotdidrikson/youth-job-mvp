-- N04: a readable company profile from a listing the caller can already see.
-- RLS on company_profiles stays owner-only. Only descriptive, company-provided fields leave the
-- function: no administrator, organisation number, street address, social links or match profile
-- (the match profile is internal assessment support, docs/PROFIL_OCH_RELEVANS.md).
create or replace function private.get_job_company_profile(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select jsonb_build_object(
   'company_name', coalesce(nullif(trim(cp.company_name),''), j.company_name, ''),
   'industry', cp.industry,
   'description', cp.description,
   'city', cp.city,
   'employee_count', cp.employee_count,
   'logo_url', cp.logo_url,
   'website_url', cp.website_url,
   'verified', cp.verification_status='verified',
   'open_jobs', (select count(*) from public.jobs o where o.company_user_id=j.company_user_id
                   and o.is_active and o.status='active' and o.publication_status='published'))
 into result
 from public.jobs j
 join public.company_profiles cp on cp.user_id=j.company_user_id
 -- Same visibility as the jobs select policy: the owner, or an active published listing.
 where j.id=p_job_id
   and (j.company_user_id=auth.uid() or (j.is_active and j.status='active' and j.publication_status='published'))
   and not public.users_are_blocked(auth.uid(), j.company_user_id);
 if result is null then raise exception 'Company profile unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function private.get_job_company_profile(uuid) from public,anon;
grant execute on function private.get_job_company_profile(uuid) to authenticated;

create or replace function public.get_job_company_profile(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_job_company_profile(p_job_id); $$;
revoke all on function public.get_job_company_profile(uuid) from public,anon;
grant execute on function public.get_job_company_profile(uuid) to authenticated;
