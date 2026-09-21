-- Security/RLS hardening after the functional release fixes.
-- Keep relationships immutable once a match or conversation exists, and make
-- account roles and private company profiles server-side data boundaries.

-- A user may select a role when their profile is first created at signup, but
-- may neither delete that profile nor replace it with a different role later.
-- The existing trigger still rejects role changes on UPDATE.
drop policy if exists "profiles own row" on public.profiles;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;

create policy "profiles own select" on public.profiles for select
  using (auth.uid() = id);
create policy "profiles own insert" on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Company profile details are not a public directory. Conversation contacts
-- already use get_my_conversation_contacts(), which returns only the required
-- display name to legitimate participants.
drop policy if exists "company profiles own row" on public.company_profiles;
drop policy if exists "company_profiles read all authenticated" on public.company_profiles;
drop policy if exists "company profiles own select" on public.company_profiles;
drop policy if exists "company profiles own insert" on public.company_profiles;
drop policy if exists "company profiles own update" on public.company_profiles;

create policy "company profiles own select" on public.company_profiles for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  );
create policy "company profiles own insert" on public.company_profiles for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  );
create policy "company profiles own update" on public.company_profiles for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'company')
  );

-- Storage object names do not encode document type. Letting every matched
-- company read a youth folder therefore exposed non-CV files through direct
-- Storage list/download calls. Companies receive a signed PDF URL only through
-- the separately authorized candidate-cv route; direct bucket reads are owner-only.
drop policy if exists "youth documents owner or matched company read" on storage.objects;
drop policy if exists "youth documents owner read" on storage.objects;
create policy "youth documents owner read" on storage.objects for select
  using (bucket_id = 'youth-documents' and auth.uid()::text = split_part(name, '/', 1));

-- A company review must remain tied to an actual youth interest. The matching
-- RPC runs as SECURITY DEFINER and independently enforces the same condition.
drop policy if exists "company reviews own jobs" on public.company_interest_actions;
drop policy if exists "company reviews own jobs select" on public.company_interest_actions;
drop policy if exists "company reviews own jobs insert" on public.company_interest_actions;
drop policy if exists "company reviews own jobs update" on public.company_interest_actions;
drop policy if exists "company reviews own jobs delete" on public.company_interest_actions;

create policy "company reviews own jobs select" on public.company_interest_actions for select
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  );
create policy "company reviews own jobs insert" on public.company_interest_actions for insert
  with check (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
    and exists (
      select 1 from public.swipe_actions
      where swipe_actions.job_id = company_interest_actions.job_id
        and swipe_actions.youth_user_id = company_interest_actions.youth_user_id
        and swipe_actions.decision = 'interested'
    )
  );
create policy "company reviews own jobs update" on public.company_interest_actions for update
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  )
  with check (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
    and exists (
      select 1 from public.swipe_actions
      where swipe_actions.job_id = company_interest_actions.job_id
        and swipe_actions.youth_user_id = company_interest_actions.youth_user_id
        and swipe_actions.decision = 'interested'
    )
  );
create policy "company reviews own jobs delete" on public.company_interest_actions for delete
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  );

-- Matches are only created by review_candidate_and_match. A listing owner may
-- update the recruitment status, but never change the participants or job.
create or replace function public.prevent_match_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.youth_user_id is distinct from old.youth_user_id
    or new.company_user_id is distinct from old.company_user_id
    or new.job_id is distinct from old.job_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Match participants and job are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists matches_prevent_identity_change on public.matches;
create trigger matches_prevent_identity_change
  before update on public.matches
  for each row execute function public.prevent_match_identity_change();

drop policy if exists "matches owner update lifecycle" on public.matches;
create policy "matches owner update lifecycle" on public.matches for update
  using (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  )
  with check (
    company_user_id = auth.uid()
    and public.is_company_account()
    and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid())
  );

-- Conversation membership comes from the match and is immutable. No browser
-- client needs direct UPDATE rights: the existing security-definer message
-- trigger updates last_message_at after an authorized insert.
create or replace function public.prevent_conversation_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.match_id is distinct from old.match_id
    or new.youth_user_id is distinct from old.youth_user_id
    or new.company_user_id is distinct from old.company_user_id
    or new.job_id is distinct from old.job_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Conversation participants and job are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists conversations_prevent_identity_change on public.conversations;
create trigger conversations_prevent_identity_change
  before update on public.conversations
  for each row execute function public.prevent_conversation_identity_change();

drop policy if exists "conversations participants update timestamp" on public.conversations;
