-- Keep approved full CV facts in private matching input. Project the selected résumé
-- entries only into new, explicitly approved application snapshots.
create function private.cv_selection_projection(p_facts jsonb, p_omitted jsonb)
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select case when jsonb_typeof(p_omitted) = 'object' then
    coalesce((select jsonb_object_agg(section.key,
      case when section.key in ('workExperience','education','projects','skills','certifications','languages','otherExperience')
        and jsonb_typeof(section.value) = 'array'
        and jsonb_typeof(p_omitted->section.key) = 'array'
      then coalesce((select jsonb_agg(item.value order by item.ordinality)
        from jsonb_array_elements(section.value) with ordinality item
        where not (p_omitted->section.key @> jsonb_build_array(item.ordinality - 1))), '[]')
      else section.value end)
    from jsonb_each(p_facts) section), '{}')
  else p_facts end;
$$;
revoke all on function private.cv_selection_projection(jsonb,jsonb) from public, anon, authenticated, service_role;

do $$
declare
  definition text := pg_get_functiondef('private.build_application_disclosure(uuid,uuid,text[])'::regprocedure);
  original text := '''structured'',cv,''documents''';
  token_input text := '''input'',internal,''job''';
  projection text := '''structured'',private.cv_selection_projection(cv,y.cv_structured->''cvOmitted''),''documents''';
begin
  if strpos(definition, original) = 0 or strpos(definition, projection) > 0 or strpos(definition, token_input) = 0 then
    raise exception 'Unexpected application disclosure projection';
  end if;
  execute replace(replace(definition, original, projection), token_input, '''input'',internal,''cv_omitted'',y.cv_structured->''cvOmitted'',''job''');
end;
$$;
