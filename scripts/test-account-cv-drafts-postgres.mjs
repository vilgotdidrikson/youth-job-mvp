// Optional local SQL verification: point N09_PGLITE_MODULE at an installed @electric-sql/pglite (tested 0.5.16).
const {PGlite}=await import(process.env.N09_PGLITE_MODULE??'@electric-sql/pglite');
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),db=new PGlite();
await db.exec(`
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth;create schema private;
grant usage on schema auth,private,public to authenticated,anon,service_role;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb,aud text,role text,created_at timestamptz,updated_at timestamptz);
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,role text);
create table public.youth_profiles(user_id uuid primary key references public.profiles(id) on delete cascade,cv_text text);
create table public.company_profiles(user_id uuid primary key references public.profiles(id) on delete cascade);
alter table public.profiles enable row level security;alter table public.youth_profiles enable row level security;
create policy own on public.profiles for select using(id=auth.uid());
create policy own on public.youth_profiles for select using(user_id=auth.uid());
grant select on public.profiles,public.youth_profiles to authenticated;
create function private.qa_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin
insert into public.profiles values(new.id,new.raw_user_meta_data->>'role');
if new.raw_user_meta_data->>'role'='youth' then insert into public.youth_profiles(user_id)values(new.id);else insert into public.company_profiles values(new.id);end if;return new;end$$;
create trigger qa_new_user after insert on auth.users for each row execute function private.qa_new_user();
`);
try{
await db.exec('begin;\n'+readFileSync(root+'/supabase/migrations/20261110164329_account_cv_drafts.sql','utf8'));
const fixture=readFileSync(root+'/scripts/test-account-cv-drafts.sql','utf8').replace(/^begin;$/m,'').replace(/^rollback;$/m,'');
const result=await db.exec(fixture);
await db.exec("delete from auth.users where id='e8abe85a-3441-4ce2-a7ab-cfb0e57dc168';do $qa$ begin if exists(select 1 from public.youth_cv_drafts where user_id='e8abe85a-3441-4ce2-a7ab-cfb0e57dc168')then raise exception 'account cascade failed';end if;end $qa$;");
console.log('PASS local deletion cascades to account CV draft.');
console.log(JSON.stringify(result.at(-1).rows));
await db.exec('rollback');console.log('PASS local PostgreSQL migration and rollback fixtures. Auth/profile bootstrap simulated.');
}finally{await db.close();}
