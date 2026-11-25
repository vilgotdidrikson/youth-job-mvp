create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_user_idx
  on public.user_blocks(blocked_user_id);

alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;

create policy "users manage own blocks"
  on public.user_blocks for all
  to authenticated
  using ((select auth.uid()) = blocker_user_id)
  with check ((select auth.uid()) = blocker_user_id);

create or replace function public.users_are_blocked(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks block
    where (block.blocker_user_id = first_user and block.blocked_user_id = second_user)
       or (block.blocker_user_id = second_user and block.blocked_user_id = first_user)
  );
$$;

create or replace function public.block_conversation_user(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  other_user_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select case
    when conversation.youth_user_id = caller_id then conversation.company_user_id
    when conversation.company_user_id = caller_id then conversation.youth_user_id
  end into other_user_id
  from public.conversations conversation
  where conversation.id = p_conversation_id
    and caller_id in (conversation.youth_user_id, conversation.company_user_id);

  if other_user_id is null then
    raise exception 'Conversation access required' using errcode = '42501';
  end if;

  insert into public.user_blocks(blocker_user_id, blocked_user_id)
  values (caller_id, other_user_id)
  on conflict do nothing;
  return other_user_id;
end;
$$;

create or replace function public.unblock_user(p_blocked_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.user_blocks
  where blocker_user_id = (select auth.uid())
    and blocked_user_id = p_blocked_user_id;
$$;

drop policy if exists "messages matched participants write" on public.messages;
drop policy if exists "messages matched unblocked participants write" on public.messages;
create policy "messages matched unblocked participants write"
  on public.messages for insert
  to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations conversation
      join public.matches match on match.id = conversation.match_id
      where conversation.id = messages.conversation_id
        and (select auth.uid()) in (conversation.youth_user_id, conversation.company_user_id)
        and match.status in ('matched', 'in_contact', 'interview', 'hired')
        and not public.users_are_blocked(conversation.youth_user_id, conversation.company_user_id)
    )
  );

revoke all on function public.users_are_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.block_conversation_user(uuid) from public, anon, authenticated;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated, service_role;
grant execute on function public.block_conversation_user(uuid) to authenticated, service_role;
grant execute on function public.unblock_user(uuid) to authenticated, service_role;
