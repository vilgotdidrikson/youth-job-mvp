-- Create application profiles inside the auth signup transaction. Email
-- confirmation can leave the browser without a session, so client-side inserts
-- cannot satisfy profiles RLS at signup time.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role text := new.raw_user_meta_data ->> 'role';
begin
  -- raw_user_meta_data is user-controlled. It is used only as signup input,
  -- validated against the roles users may select, then copied to the protected
  -- and immutable public.profiles row. It is never used directly by RLS.
  if selected_role is null or selected_role not in ('youth', 'company', 'private') then
    raise exception using
      errcode = '22023',
      message = 'A valid account role is required.';
  end if;

  insert into public.profiles (id, role)
  values (new.id, selected_role);

  case selected_role
    when 'youth' then
      insert into public.youth_profiles (user_id) values (new.id);
    when 'company' then
      insert into public.company_profiles (user_id) values (new.id);
    when 'private' then
      insert into public.private_profiles (user_id) values (new.id);
  end case;

  return new;
end;
$$;

revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();
