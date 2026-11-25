-- Internal review only. No user-facing export endpoint may return these rows.
-- Invoker privileges deliberately remain those of the existing service role.
create function public.read_personal_data_review_page(
 p_source text, p_subject_id uuid, p_after_id uuid default null, p_limit integer default 100
) returns setof jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if current_user <> 'service_role' then
  raise exception using errcode='42501', message='Review reader is restricted';
 end if;
 if p_subject_id is null or p_limit is null or p_limit < 1 or p_limit > 100
    or p_source is null or p_source not in ('private.application_disclosures','public.candidate_assessments') then
  raise exception using errcode='22023', message='Invalid review request';
 end if;
 -- This reader is for a youth's OWN data, never a company's candidate export.
 if not exists(select 1 from public.profiles where id=p_subject_id and role='youth') then
  raise exception using errcode='22023', message='Invalid review subject';
 end if;
 if p_source='private.application_disclosures' then
  return query
   select jsonb_build_object('job_id',d.job_id,'youth_user_id',d.youth_user_id,
    'revision',d.revision,'selected_keys',d.selected_keys,'packet',d.packet,
    'matching_input',d.matching_input,'created_at',d.created_at,'updated_at',d.updated_at)
   from private.application_disclosures d
   where d.youth_user_id=p_subject_id and (p_after_id is null or d.job_id>p_after_id)
   order by d.job_id limit p_limit;
 else
  -- Includes historical revisions; caller-facing company RLS intentionally does not.
  return query
   select jsonb_build_object('id',a.id,'job_id',a.job_id,'youth_user_id',a.youth_user_id,
    'company_user_id',a.company_user_id,'job_profile_version',a.job_profile_version,
    'result',a.result,'criteria_snapshot',a.criteria_snapshot,'created_at',a.created_at)
   from public.candidate_assessments a
   where a.youth_user_id=p_subject_id and (p_after_id is null or a.id>p_after_id)
   order by a.id limit p_limit;
 end if;
end;
$$;
revoke all on function public.read_personal_data_review_page(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.read_personal_data_review_page(text,uuid,uuid,integer) to service_role;
comment on function public.read_personal_data_review_page(text,uuid,uuid,integer) is
 'Service-only youth-owned private/history review material; not a complete or approved export.';
