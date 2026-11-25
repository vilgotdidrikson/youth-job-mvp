-- Preserve the historical hire marker while allowing the user who recorded it to
-- delete their account. All participant links still cascade through the match.
alter table public.matches
  drop constraint if exists matches_hired_by_user_id_fkey;

alter table public.matches
  add constraint matches_hired_by_user_id_fkey
  foreign key (hired_by_user_id)
  references auth.users(id)
  on delete set null;
