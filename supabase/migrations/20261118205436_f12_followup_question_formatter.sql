-- Both automatic queues use this formatter. Existing question history stays as stored.
create or replace function private.application_followup_question(label text)
returns text language sql immutable security invoker set search_path = '' as $$
  with first_mentions as (
    select lower(parts[1]) as language, min(position) as first_seen
    from regexp_matches(label, '\m(svenska|engelska|spanska|franska|tyska|arabiska|polska|italienska|finska|danska|norska|persiska|turkiska|ukrainska|ryska|kinesiska|teckenspråk)\M', 'gi')
      with ordinality as item(parts, position)
    group by lower(parts[1])
  ), recognized as (
    select array_agg(language order by first_seen) as names from first_mentions
  )
  select case
    when cardinality(names) > 0 then
      'Hur beskriver du dina kunskaper i ' ||
      case when cardinality(names) = 1 then names[1]
        else array_to_string(names[1:cardinality(names)-1], ', ') || ' och ' || names[cardinality(names)]
      end || '? Ange gärna din nivå i tal och skrift.' ||
      case when lower(btrim(label)) = names[1] and cardinality(names) = 1 then ''
        else ' Annonsens önskemål: ”' || label || '”.' end
    when label ~* '\mspråk\M' then
      'Vilka språk kan du använda i arbetet? Ange gärna din nivå i tal och skrift. Annonsens önskemål: ”' || label || '”.'
    when label ~* '(börja|start|tillträde|omgående)' and label !~* '(helg|kväll|arbetstid|tider|skift)' then
      'Vilket är ditt tidigaste startdatum? Annonsens önskemål: ' || label || '.'
    when label ~* '(helg|arbetstid|tillgäng|kväll|dagtid)' then
      'Vilka dagar och tider kan du arbeta? Annonsens önskemål: ' || label || '.'
    else 'Vad vill du lägga till om ”' || label || '”? Beskriv gärna dina kunskaper eller ge ett exempel från jobb, skola eller fritid.'
  end from recognized;
$$;
