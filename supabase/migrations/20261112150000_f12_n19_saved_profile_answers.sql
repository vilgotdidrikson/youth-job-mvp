-- F12/N19: answers a youth explicitly chose to keep from an application supplement.
-- They live as an optional fifth key in the existing recruitment profile, so the
-- versioned owner-only save, the CHECK constraint, export and deletion already apply.
-- No table, column, bucket, policy or grant on existing objects changes.
-- Each patch stops if the live function differs from the expected definition.

create function public.valid_saved_profile_answers(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; stamp text;
begin
  if p is null or jsonb_typeof(p)<>'array' or jsonb_array_length(p)>8 then return false; end if;
  for item in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>4 or not item ?& array['text','question','savedAt','source'] then return false; end if;
    if jsonb_typeof(item->'text')<>'string' or length(btrim(item->>'text')) not between 1 and 600
      or jsonb_typeof(item->'question')<>'string' or length(btrim(item->>'question')) not between 1 and 300
      or jsonb_typeof(item->'source')<>'string' or length(btrim(item->>'source')) not between 1 and 120
      or jsonb_typeof(item->'savedAt')<>'string' or (item->>'savedAt') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    stamp:=item->>'savedAt';
    perform make_date(substring(stamp,1,4)::integer,substring(stamp,6,2)::integer,substring(stamp,9,2)::integer);
  end loop;
  if (select count(distinct x->>'source') from jsonb_array_elements(p) x)<>jsonb_array_length(p) then return false; end if;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.valid_saved_profile_answers(jsonb) from public,anon;
grant execute on function public.valid_saved_profile_answers(jsonb) to authenticated,service_role;

do $migration$
declare definition text; old_guard text; new_guard text;
begin
  -- 1. Profile validation: optional savedAnswers, all four original keys still required.
  select pg_get_functiondef('public.valid_recruitment_profile(jsonb)'::regprocedure) into definition;
  old_guard:=$old$if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>16000 then return false; end if;$old$;
  new_guard:=$new$if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>24000 then return false; end if;
  if p ? 'savedAnswers' then
    if not public.valid_saved_profile_answers(p->'savedAnswers') then return false; end if;
    p:=p-'savedAnswers';
  end if;
  if octet_length(p::text)>16000 then return false; end if;$new$;
  if strpos(definition,old_guard)=0 or strpos(definition,'savedAnswers')>0 then raise exception 'Expected profile size guard missing; stop rather than replace unrelated validation'; end if;
  execute replace(definition,old_guard,new_guard);

  -- 2. Versioned owner save: accept the new section name, nothing else changes.
  select pg_get_functiondef('public.save_my_recruitment_profile(text,jsonb,integer)'::regprocedure) into definition;
  old_guard:=$old$array['availability','preferences','examples','qualifications']) or p_value is null$old$;
  new_guard:=$new$array['availability','preferences','examples','qualifications','savedAnswers']) or p_value is null$new$;
  if strpos(definition,old_guard)=0 then raise exception 'Expected profile section guard missing; stop rather than replace unrelated save logic'; end if;
  execute replace(definition,old_guard,new_guard);

  -- 3. Application disclosure: a saved answer is an optional item like an own example.
  -- Only its text can be selected; the question and source of another application are never shared.
  select pg_get_functiondef('private.build_application_disclosure(uuid,uuid,text[])'::regprocedure) into definition;
  old_guard:=$old$ if coalesce(r->'preferences'->>'motivation','')<>'' then options:=$old$;
  new_guard:=$new$ for pair in select value,ordinality-1 as idx from jsonb_array_elements(coalesce(r->'savedAnswers','[]')) with ordinality loop
  options:=options||jsonb_build_array(jsonb_build_object('key','answer:'||pair.idx,'label','Sparad egen uppgift – självuppgiven','value',pair.value->'text','text',pair.value->>'text'));
 end loop;
 if coalesce(r->'preferences'->>'motivation','')<>'' then options:=$new$;
  if strpos(definition,old_guard)=0 or strpos(definition,'savedAnswers')>0 then raise exception 'Expected disclosure option anchor missing; stop rather than replace unrelated sharing logic'; end if;
  execute replace(definition,old_guard,new_guard);
end; $migration$;
