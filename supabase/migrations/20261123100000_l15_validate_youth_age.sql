-- Existing profiles can be incomplete. Validate new or changed age information
-- without rewriting old data or making account creation depend on a birth date.
create or replace function private.validate_youth_age() returns trigger
language plpgsql set search_path = '' as $$
declare
  local_date date := (now() at time zone 'Europe/Stockholm')::date;
  reported_years integer;
begin
  if tg_op = 'UPDATE' and new.date_of_birth is not distinct from old.date_of_birth
    and new.age is not distinct from old.age then
    return new;
  end if;

  if new.date_of_birth is not null then
    reported_years := extract(year from age(local_date, new.date_of_birth))::integer;
    if new.date_of_birth > local_date or reported_years > 120 then
      raise exception using errcode = '22023', message = 'Kontrollera födelsedatumet.';
    end if;
    new.age := reported_years;
  end if;

  if new.age is not null and new.age < 15 then
    raise exception using errcode = '22023', message = 'Du behöver ha fyllt 15 år för att använda MatchnWork.';
  end if;
  if new.age is not null and new.age > 120 then
    raise exception using errcode = '22023', message = 'Kontrollera åldern.';
  end if;
  return new;
end;
$$;

create trigger validate_youth_age
before insert or update of date_of_birth, age on public.youth_profiles
for each row execute function private.validate_youth_age();
