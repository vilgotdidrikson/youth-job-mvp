import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { PGlite } = await import(process.env.MNW_CASE_PGLITE_MODULE || "@electric-sql/pglite");
const db = await PGlite.create();
const youth = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const oldJob = "33333333-3333-4333-8333-333333333333";
const newJob = "44444444-4444-4444-8444-444444444444";
const migration = await readFile(new URL("../supabase/migrations/20261122200000_f20_application_ai_consent.sql", import.meta.url), "utf8");
const scalar = async (sql, args) => Object.values((await db.query(sql, args)).rows[0])[0];
const choose = enabled => scalar("select public.my_application_ai_preference($1)", [enabled]);
const allowed = job => scalar("select public.application_ai_allowed($1,$2)", [job, youth]);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.profiles(id uuid primary key);
    create table public.youth_profiles(user_id uuid primary key);
    create table public.application_completions(job_id uuid,youth_user_id uuid,status text,submitted_at timestamptz);
    create table public.jobs(id uuid,company_user_id uuid,status text,is_active boolean,publication_status text);
    create table public.company_profiles(user_id uuid,verification_status text);
    create table public.swipe_actions(job_id uuid,youth_user_id uuid,decision text);
    create table public.job_match_profiles(job_id uuid,status text);
    create table public.company_interest_actions(job_id uuid,youth_user_id uuid,decision text);
    create table public.matches(job_id uuid,youth_user_id uuid,status text);
    create table public.application_analysis_jobs(job_id uuid,youth_user_id uuid,status text,completed_input_hash text,updated_at timestamptz,attempts int);
    create table public.candidate_assessments(job_id uuid,youth_user_id uuid,company_user_id uuid,result jsonb,input_hash text,created_at timestamptz);
    create table private.application_disclosures(job_id uuid,youth_user_id uuid,revision int);
    create function private.application_content_available(uuid,uuid) returns boolean language sql as $$select true$$;
    create function public.users_are_blocked(uuid,uuid) returns boolean language sql as $$select false$$;
    create function private.disclosure_company_access(uuid,uuid,uuid) returns boolean language sql as $$select true$$;
    create function public.get_candidate_assessment_input(uuid,uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into public.profiles values ('${youth}'),('${other}');
    insert into public.youth_profiles values ('${youth}');
    insert into public.application_completions values ('${oldJob}','${youth}','submitted',now()-interval '1 day');
    select set_config('request.jwt.claim.sub','${youth}',false);
  `);
  await db.exec(migration);
  assert.equal(await choose(null), false);
  assert.equal(await allowed(oldJob), false);
  assert.equal(await choose(true), true);
  assert.equal(await allowed(oldJob), false);
  await db.query("insert into public.application_completions values ($1,$2,'submitted',clock_timestamp())", [newJob, youth]);
  assert.equal(await allowed(newJob), true);
  assert.equal(await choose(true), true);
  assert.equal(await allowed(newJob), true);
  await db.exec(`
    insert into public.jobs values ('${newJob}','${other}','active',true,'published');
    insert into public.company_profiles values ('${other}','verified');
    insert into public.swipe_actions values ('${newJob}','${youth}','interested');
    insert into public.job_match_profiles values ('${newJob}','approved');
    insert into private.application_disclosures values ('${newJob}','${youth}',1);
  `);
  assert.equal(await scalar("select private.application_analysis_eligible($1,$2)", [newJob, youth]), true);
  assert.equal(await choose(false), false);
  assert.equal(await allowed(newJob), false);
  assert.equal(await scalar("select public.get_application_assessment_state($1,$2)->>'status'", [newJob, youth]), "unavailable");
  assert.equal(await scalar("select public.get_application_matching_input($1,$2,$3) is null", [newJob, youth, other]), true);
  assert.equal(await scalar("select private.application_analysis_eligible($1,$2)", [newJob, youth]), false);
  assert.equal(await choose(true), true);
  assert.equal(await allowed(newJob), false);
  assert.equal(await scalar("select has_function_privilege('authenticated','public.application_ai_allowed(uuid,uuid)','execute')"), false);
  assert.equal(await scalar("select has_function_privilege('anon','public.my_application_ai_preference(boolean)','execute')"), false);
  assert.equal(await scalar("select has_table_privilege('authenticated','private.application_ai_preferences','select')"), false);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  await assert.rejects(() => choose(true), { code: "42501" });
  await db.query("delete from public.profiles where id=$1", [youth]);
  assert.equal(await scalar("select count(*)::int from private.application_ai_preferences"), 0);
  console.log("Application AI preference PostgreSQL checks passed.");
} finally {
  await db.close();
}
