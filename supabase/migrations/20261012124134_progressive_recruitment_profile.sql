-- All sections are optional. This data does not gate CV completion or applications.
alter table public.youth_profiles add column if not exists recruitment_profile jsonb not null default '{"availability":{"days":[],"periods":[],"startDate":"","hours":""},"preferences":{"roles":[],"locations":[],"travelMinutes":"","motivation":""},"examples":[],"qualifications":{"licences":[],"tools":[],"languages":[]}}'::jsonb;
alter table public.youth_profiles add column if not exists recruitment_profile_version integer not null default 0;

create or replace function public.valid_recruitment_profile(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare value jsonb; key text; item jsonb; date_value date;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>16000 then return false; end if;
  if (select count(*) from jsonb_object_keys(p))<>4 or not p ?& array['availability','preferences','examples','qualifications'] then return false; end if;
  if jsonb_typeof(p->'availability')<>'object' or jsonb_typeof(p->'preferences')<>'object' or jsonb_typeof(p->'qualifications')<>'object' or jsonb_typeof(p->'examples')<>'array' then return false; end if;
  if not (p->'availability') ?& array['days','periods','startDate','hours'] or (select count(*) from jsonb_object_keys(p->'availability'))<>4 then return false; end if;
  if not (p->'preferences') ?& array['roles','locations','travelMinutes','motivation'] or (select count(*) from jsonb_object_keys(p->'preferences'))<>4 then return false; end if;
  if not (p->'qualifications') ?& array['licences','tools','languages'] or (select count(*) from jsonb_object_keys(p->'qualifications'))<>3 then return false; end if;
  foreach key in array array['days','periods'] loop
    value:=p->'availability'->key;
    if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>(case when key='days' then 7 else 4 end) then return false; end if;
    for item in select * from jsonb_array_elements(value) loop
      if jsonb_typeof(item)<>'string' or (key='days' and not (item #>> '{}')=any(array['mon','tue','wed','thu','fri','sat','sun'])) or (key='periods' and not (item #>> '{}')=any(array['day','evening','night','holidays'])) then return false; end if;
    end loop;
  end loop;
  foreach key in array array['startDate','hours'] loop if jsonb_typeof(p->'availability'->key)<>'string' then return false; end if; end loop;
  if p->'availability'->>'startDate'<>'' then
    if (p->'availability'->>'startDate') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    date_value:=make_date(substring(p->'availability'->>'startDate',1,4)::integer,substring(p->'availability'->>'startDate',6,2)::integer,substring(p->'availability'->>'startDate',9,2)::integer);
  end if;
  if p->'availability'->>'hours'<>'' and ((p->'availability'->>'hours') !~ '^\d{1,2}$' or (p->'availability'->>'hours')::integer>60) then return false; end if;
  foreach key in array array['roles','locations'] loop
    value:=p->'preferences'->key;
    if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>8 then return false; end if;
    for item in select * from jsonb_array_elements(value) loop if jsonb_typeof(item)<>'string' or length(item #>> '{}')>80 then return false; end if; end loop;
  end loop;
  if jsonb_typeof(p->'preferences'->'motivation')<>'string' or length(p->'preferences'->>'motivation')>1000 or jsonb_typeof(p->'preferences'->'travelMinutes')<>'string' then return false; end if;
  if p->'preferences'->>'travelMinutes'<>'' and ((p->'preferences'->>'travelMinutes') !~ '^\d{1,3}$' or (p->'preferences'->>'travelMinutes')::integer>180) then return false; end if;
  if jsonb_array_length(p->'examples')>5 then return false; end if;
  for item in select * from jsonb_array_elements(p->'examples') loop
    if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3 or not item ?& array['strength','context','action'] then return false; end if;
    if jsonb_typeof(item->'strength')<>'string' or not (item->>'strength')=any(array['service','teamwork','responsibility','initiative','learning']) or jsonb_typeof(item->'context')<>'string' or length(btrim(item->>'context')) not between 1 and 200 or jsonb_typeof(item->'action')<>'string' or length(btrim(item->>'action')) not between 1 and 1000 then return false; end if;
  end loop;
  foreach key in array array['licences','tools'] loop
    value:=p->'qualifications'->key;
    if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>(case when key='licences' then 8 else 12 end) then return false; end if;
    for item in select * from jsonb_array_elements(value) loop if jsonb_typeof(item)<>'string' or length(item #>> '{}')>80 then return false; end if; end loop;
  end loop;
  value:=p->'qualifications'->'languages';
  if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>8 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['language','level'] then return false; end if;
    if jsonb_typeof(item->'language')<>'string' or length(btrim(item->>'language')) not between 1 and 60 or jsonb_typeof(item->'level')<>'string' or not (item->>'level')=any(array['Grundläggande','God','Mycket god','Flytande','Modersmål']) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.valid_recruitment_profile(jsonb) from public,anon;
grant execute on function public.valid_recruitment_profile(jsonb) to authenticated,service_role;
alter table public.youth_profiles add constraint youth_recruitment_profile_valid check (public.valid_recruitment_profile(recruitment_profile));

create or replace function private.version_recruitment_profile()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='INSERT' then new.recruitment_profile_version:=0;
  elsif new.recruitment_profile is distinct from old.recruitment_profile then new.recruitment_profile_version:=old.recruitment_profile_version+1; new.updated_at:=now();
  else new.recruitment_profile_version:=old.recruitment_profile_version; end if;
  return new;
end; $$;
revoke all on function private.version_recruitment_profile() from public,anon,authenticated;
create trigger version_recruitment_profile before insert or update of recruitment_profile,recruitment_profile_version on public.youth_profiles for each row execute function private.version_recruitment_profile();

create or replace function public.save_my_recruitment_profile(p_section text,p_value jsonb,p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare row_value public.youth_profiles; next_profile jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth access required' using errcode='42501'; end if;
  if p_section is null or not p_section=any(array['availability','preferences','examples','qualifications']) or p_value is null then raise exception 'Invalid profile section' using errcode='22023'; end if;
  select * into row_value from public.youth_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if p_expected_version is null or row_value.recruitment_profile_version<>p_expected_version then raise exception 'Profilen har ändrats. Läs in den igen innan du sparar.' using errcode='40001'; end if;
  next_profile:=jsonb_set(row_value.recruitment_profile,array[p_section],p_value);
  if not public.valid_recruitment_profile(next_profile) then raise exception 'Kontrollera profiluppgifterna och försök igen.' using errcode='22023'; end if;
  update public.youth_profiles set recruitment_profile=next_profile where user_id=auth.uid() returning * into row_value;
  return jsonb_build_object('profile',row_value.recruitment_profile,'version',row_value.recruitment_profile_version);
end; $$;
revoke all on function public.save_my_recruitment_profile(text,jsonb,integer) from public,anon;
grant execute on function public.save_my_recruitment_profile(text,jsonb,integer) to authenticated;

-- Add the same optional data to existing, already authorized assessment inputs.
-- All ownership, submitted-interest, verification and block checks are retained.
do $$
declare function_name text; definition text;
begin
  foreach function_name in array array['get_candidate_assessment_input','get_my_application_followup_input'] loop
    select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=function_name;
    if definition is null or position('''cv_text'',y.cv_text,' in definition)=0 then raise exception 'Assessment input definition not found: %',function_name; end if;
    definition:=replace(definition,'''cv_text'',y.cv_text,','''cv_text'',y.cv_text,''recruitment_profile'',y.recruitment_profile,');
    execute definition;
  end loop;
end; $$;
