-- Private working material: never joined into matching or employer disclosure.
create function private.cv_draft_tree_safe(v jsonb, depth integer default 0)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare pair record; item jsonb;
begin
 if depth>24 then return false; end if;
 case jsonb_typeof(v)
 when 'object' then
  for pair in select * from jsonb_each(v) loop
   if length(pair.key)>128 or pair.key in ('__proto__','prototype','constructor','approval','approvedSnapshot','access_token','refresh_token') or not private.cv_draft_tree_safe(pair.value,depth+1) then return false; end if;
  end loop;
 when 'array' then
  if jsonb_array_length(v)>100 then return false; end if;
  for item in select * from jsonb_array_elements(v) loop if not private.cv_draft_tree_safe(item,depth+1) then return false; end if; end loop;
 when 'string' then if length(v#>>'{}')>32000 then return false; end if;
 when 'number' then null;
 when 'boolean' then null;
 when 'null' then null;
 else return false;
 end case;
 return true;
end; $$;
revoke all on function private.cv_draft_tree_safe(jsonb,integer) from public,anon,authenticated;

create function private.valid_account_cv_draft(v jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; forms text[]:=array['about','school','program','graduation','experience','skills','languages','merits','linkedin','portfolio','otherLink'];
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>120000 then return false; end if;
 if (v-array['version','method','step','draft','returnToReview','editedSections','generated','reviewSource'])<>'{}'::jsonb
  or not (v ?& array['version','method','step','draft','returnToReview','editedSections','generated','reviewSource']) then return false; end if;
 if v->'version'<>'1'::jsonb or jsonb_typeof(v->'method') is distinct from 'string' or jsonb_typeof(v->'step') is distinct from 'string' or v->>'method' not in ('manual','ai') or v->>'step' not in ('start','pdf','preview','review','about','education','experience','skills','languages','merits')
  or jsonb_typeof(v->'returnToReview')<>'boolean' or jsonb_typeof(v->'reviewSource')<>'string' then return false; end if;
 if jsonb_typeof(v->'draft')<>'object' or ((v->'draft')-array['about','school','program','graduation','experience','skills','languages','merits','linkedin','portfolio','otherLink','noExperience'])<>'{}'::jsonb or jsonb_typeof(v->'draft'->'noExperience') is distinct from 'boolean' then return false; end if;
 foreach k in array forms loop if jsonb_typeof(v->'draft'->k) is distinct from 'string' or length(v->'draft'->>k)>12000 then return false; end if; end loop;
 if jsonb_typeof(v->'editedSections')<>'array' then return false; end if;
 if jsonb_array_length(v->'editedSections')>6 or exists(select 1 from jsonb_array_elements(v->'editedSections') a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('about','education','experience','skills','languages','merits')) then return false; end if;
 if (select count(*)<>count(distinct a) from jsonb_array_elements(v->'editedSections') a) then return false; end if;
 if v->'generated'<>'null'::jsonb then
  if jsonb_typeof(v->'generated')<>'object' or (v->'generated')-array['text','structured']<>'{}'::jsonb or jsonb_typeof(v->'generated'->'text') is distinct from 'string' or jsonb_typeof(v->'generated'->'structured') is distinct from 'object' then return false; end if;
 elsif v->>'step'='preview' then return false;
 end if;
 return private.cv_draft_tree_safe(v);
end; $$;
revoke all on function private.valid_account_cv_draft(jsonb) from public,anon,authenticated;

create table public.youth_cv_drafts (
 user_id uuid primary key references public.youth_profiles(user_id) on delete cascade,
 revision uuid not null default gen_random_uuid(),
 content jsonb,
 updated_at timestamptz not null default now(),
 constraint valid_cv_draft check(content is null or private.valid_account_cv_draft(content))
);
alter table public.youth_cv_drafts enable row level security;
revoke all on public.youth_cv_drafts from public,anon,authenticated;
grant select on public.youth_cv_drafts to authenticated;
grant all on public.youth_cv_drafts to service_role;
create policy youth_cv_draft_owner_read on public.youth_cv_drafts for select to authenticated
 using(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth'));

-- The definer is private because direct table writes are intentionally denied.
-- Locks the existing owner row so concurrent first saves/deletes are serialized.
create function private.save_my_cv_draft(p_expected_revision uuid,p_content jsonb)
returns setof public.youth_cv_drafts language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing public.youth_cv_drafts%rowtype;
begin
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.profiles p where p.id=caller and p.role='youth') then raise exception 'Youth account required' using errcode='42501'; end if;
 if p_content is not null and not private.valid_account_cv_draft(p_content) then raise exception 'Invalid CV draft' using errcode='22023'; end if;
 perform 1 from public.youth_profiles p where p.user_id=caller for update;
 if not found then raise exception 'Youth profile required' using errcode='42501'; end if;
 select d.* into existing from public.youth_cv_drafts d where d.user_id=caller;
 if existing.user_id is not null then
  if p_expected_revision is distinct from existing.revision then raise exception 'CV draft changed; read current version' using errcode='PT409'; end if;
  -- A tombstone retains the revision, protecting against stale create after clear.
  return query update public.youth_cv_drafts d set content=p_content,revision=gen_random_uuid(),updated_at=clock_timestamp() where d.user_id=caller returning d.*;
 else
  if p_expected_revision is not null then raise exception 'CV draft changed; read current version' using errcode='PT409'; end if;
  return query insert into public.youth_cv_drafts(user_id,content) values(caller,p_content) returning *;
 end if;
end; $$;
revoke all on function private.save_my_cv_draft(uuid,jsonb) from public,anon;
grant execute on function private.save_my_cv_draft(uuid,jsonb) to authenticated;

create function public.save_my_cv_draft(p_expected_revision uuid,p_content jsonb)
returns setof public.youth_cv_drafts language sql security invoker set search_path='' as $$
 select * from private.save_my_cv_draft(p_expected_revision,p_content);
$$;
revoke all on function public.save_my_cv_draft(uuid,jsonb) from public,anon;
grant execute on function public.save_my_cv_draft(uuid,jsonb) to authenticated;
