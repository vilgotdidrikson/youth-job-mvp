import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { PGlite } = await import(process.env.MNW_CASE_PGLITE_MODULE || "@electric-sql/pglite");
const db = await PGlite.create();
const migration = await readFile(new URL("../supabase/migrations/20261123121000_l12_private_cv_work_retention.sql", import.meta.url), "utf8");
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table public.youth_cv_drafts(user_id uuid primary key, revision uuid not null, content jsonb, updated_at timestamptz);
    create table public.ai_onboarding_sessions(id uuid primary key, created_at timestamptz, completed_at timestamptz);
    create table public.ai_onboarding_messages(session_id uuid references public.ai_onboarding_sessions(id) on delete cascade, created_at timestamptz);
    insert into public.youth_cv_drafts values
      ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','{"draft":true}',now()-interval '91 days'),
      ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000010','{"draft":true}',now()-interval '89 days');
    insert into public.ai_onboarding_sessions values
      ('00000000-0000-4000-8000-000000000003',now()-interval '91 days',null),
      ('00000000-0000-4000-8000-000000000004',now()-interval '91 days',null),
      ('00000000-0000-4000-8000-000000000005',now()-interval '91 days',now()-interval '10 days');
    insert into public.ai_onboarding_messages values
      ('00000000-0000-4000-8000-000000000003',now()-interval '91 days'),
      ('00000000-0000-4000-8000-000000000004',now()-interval '89 days');
  `);
  await db.exec(migration);
  const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
  assert.equal(await scalar("select has_function_privilege('authenticated','private.purge_inactive_cv_work(integer)','execute')"), false);
  assert.deepEqual(await scalar("select private.purge_inactive_cv_work(10)"), { draftsCleared: 1, sessionsRemoved: 1 });
  assert.equal(await scalar("select count(*)::int from public.youth_cv_drafts where content is not null"), 1);
  assert.equal(await scalar("select count(*)::int from public.youth_cv_drafts where content is null and revision <> '00000000-0000-4000-8000-000000000010'"), 1);
  assert.equal(await scalar("select count(*)::int from public.ai_onboarding_sessions"), 2);
  assert.equal(await scalar("select count(*)::int from public.ai_onboarding_messages"), 1);
  await assert.rejects(() => db.exec("insert into public.ai_onboarding_messages values ('00000000-0000-4000-8000-000000000003',now())"), { code: "23503" });
  assert.deepEqual(await scalar("select private.purge_inactive_cv_work(10)"), { draftsCleared: 0, sessionsRemoved: 0 });
  console.log("Private CV retention PostgreSQL checks passed.");
} finally {
  await db.close();
}
