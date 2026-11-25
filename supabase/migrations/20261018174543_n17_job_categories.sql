-- N17: additive categories; preserve all original free category/title text.
create function public.valid_job_category_ids(p_ids text[])
returns boolean language sql immutable security invoker set search_path='' as $$
 select p_ids is not null and cardinality(p_ids)<=15 and array_position(p_ids,null) is null
  and p_ids <@ array['cafe','restaurant','retail','childcare','sports','events','warehouse','delivery','customer-service','administration','finance','supervision','social-media','cleaning','gardening']::text[]
  and cardinality(p_ids)=(select count(distinct x) from unnest(p_ids) x);
$$;
revoke all on function public.valid_job_category_ids(text[]) from public,anon;
grant execute on function public.valid_job_category_ids(text[]) to authenticated,service_role;
alter table public.jobs add column job_category_ids text[] not null default '{}',
 add column job_category_manual boolean not null default false,
 add constraint jobs_valid_category_ids check(cardinality(job_category_ids)<=3 and public.valid_job_category_ids(job_category_ids));
-- No backfill guesses or changes to existing RLS/grants/publication timestamps.
-- Legacy rows are read through the shared conservative compatibility resolver.

-- Accept optional canonical preference IDs while keeping all original role text
-- and the existing four-key preferences shape backwards compatible.
do $migration$
declare definition text; old_guard text; new_guard text;
begin
 select pg_get_functiondef('public.valid_recruitment_profile(jsonb)'::regprocedure) into definition;
 old_guard:=$old$if not (p->'preferences') ?& array['roles','locations','travelMinutes','motivation'] or (select count(*) from jsonb_object_keys(p->'preferences'))<>4 then return false; end if;$old$;
 new_guard:=$new$if not (p->'preferences') ?& array['roles','locations','travelMinutes','motivation'] or exists(select 1 from jsonb_object_keys(p->'preferences') k where k not in ('roles','locations','travelMinutes','motivation','categoryIds')) then return false; end if;
 if (p->'preferences') ? 'categoryIds' then
  value:=p->'preferences'->'categoryIds';
  if jsonb_typeof(value)<>'array' or exists(select 1 from jsonb_array_elements(value) x where jsonb_typeof(x)<>'string') then return false; end if;
  if not public.valid_job_category_ids(array(select jsonb_array_elements_text(value))) then return false; end if;
 end if;$new$;
 if strpos(definition,old_guard)=0 then raise exception 'Expected preferences guard missing; stop rather than replace unrelated validation'; end if;
 execute replace(definition,old_guard,new_guard);
end; $migration$;
