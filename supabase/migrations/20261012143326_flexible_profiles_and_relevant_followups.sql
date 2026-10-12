create or replace function public.valid_recruitment_profile(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare value jsonb; key text; item jsonb; date_value date;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>16000 then return false; end if;
  if (select count(*) from jsonb_object_keys(p))<>4 or not p ?& array['availability','preferences','examples','qualifications'] then return false; end if;
  if jsonb_typeof(p->'availability')<>'object' or jsonb_typeof(p->'preferences')<>'object' or jsonb_typeof(p->'qualifications')<>'object' or jsonb_typeof(p->'examples')<>'array' then return false; end if;
  if not (p->'availability') ?& array['days','periods','startDate','hours'] or exists(select 1 from jsonb_object_keys(p->'availability') k where k not in ('days','periods','startDate','hours','notes')) then return false; end if;
  if not (p->'preferences') ?& array['roles','locations','travelMinutes','motivation'] or (select count(*) from jsonb_object_keys(p->'preferences'))<>4 then return false; end if;
  if not (p->'qualifications') ?& array['licences','tools','languages'] or (select count(*) from jsonb_object_keys(p->'qualifications'))<>3 then return false; end if;
  foreach key in array array['days','periods'] loop
    value:=p->'availability'->key;
    if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>(case when key='days' then 7 else 4 end) then return false; end if;
    for item in select * from jsonb_array_elements(value) loop
      if jsonb_typeof(item)<>'string' or (key='days' and not (item #>> '{}')=any(array['mon','tue','wed','thu','fri','sat','sun'])) or (key='periods' and not (item #>> '{}')=any(array['day','evening','night','holidays'])) then return false; end if;
    end loop;
  end loop;
  if (p->'availability') ? 'notes' and (jsonb_typeof(p->'availability'->'notes')<>'string' or length(p->'availability'->>'notes')>1000) then return false; end if;
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
    if jsonb_typeof(item->'strength')<>'string' or length(btrim(item->>'strength')) not between 1 and 30 or jsonb_typeof(item->'context')<>'string' or length(btrim(item->>'context')) not between 1 and 200 or jsonb_typeof(item->'action')<>'string' or length(btrim(item->>'action')) not between 1 and 1000 then return false; end if;
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
    if jsonb_typeof(item->'language')<>'string' or length(btrim(item->>'language')) not between 1 and 60 or jsonb_typeof(item->'level')<>'string' or length(btrim(item->>'level')) not between 1 and 30 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.valid_recruitment_profile(jsonb) from public,anon;
grant execute on function public.valid_recruitment_profile(jsonb) to authenticated,service_role;

-- One question formatter shared by the authenticated path and durable worker.
create or replace function private.application_followup_question(label text)
returns text language sql immutable security invoker set search_path = '' as $$
select case
 when label ~* '(svenska|engelska|spanska|språk)' then 'Hur beskriver du dina kunskaper i '||label||'? Ange gärna din nivå och om du kan använda språket i tal och skrift.'
 when label ~* '(börja|start|tillträde|omgående)' and label !~* '(helg|kväll|arbetstid|tider|skift)' then 'Vilket är ditt tidigaste startdatum? Annonsens önskemål: '||label||'.'
 when label ~* '(helg|arbetstid|tillgäng|kväll|dagtid)' then 'Vilka dagar och tider kan du arbeta? Annonsens önskemål: '||label||'.'
 else 'Vad vill du lägga till om ”'||label||'”? Beskriv gärna dina kunskaper eller ge ett exempel från jobb, skola eller fritid.' end;
$$;
revoke all on function private.application_followup_question(text) from public,anon,authenticated;
-- Patch only the question assignment, retaining existing authorization/version/lease guards.
do $$
declare definition text; routine text; begin
 foreach routine in array array['queue_application_followups','finish_application_analysis_job'] loop
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=routine;
  if definition is null then raise exception 'Missing function: %',routine; end if;
  if routine='queue_application_followups' then
   definition:=regexp_replace(definition,'if label ~\* ''\(helg[^;]+;\s*else\s*question:=[^;]+;\s*end if;', 'question:=private.application_followup_question(label);','i');
  else
   definition:=regexp_replace(definition,'question:=case when label ~\*[^;]+ end;', 'question:=private.application_followup_question(label);','i');
  end if;
  if position('private.application_followup_question(label)' in definition)=0 then raise exception 'Question assignment not found: %',routine; end if;
  execute definition;
 end loop;
end; $$;
