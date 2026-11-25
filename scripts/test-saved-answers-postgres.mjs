// Local SQL verification of the F12/N19 saved-answers migration in real PostgreSQL (PGlite).
// Point MNW_SAVED_PGLITE_MODULE at an installed @electric-sql/pglite (tested 0.5.16).
// The base functions are taken verbatim from the repository migrations, then the new migration is applied.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const pglitePath = process.env.MNW_SAVED_PGLITE_MODULE;
const { PGlite } = await import(pglitePath ? pathToFileURL(pglitePath).href : '@electric-sql/pglite');
const root = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const file = name => readFileSync(root + name, 'utf8').replace(/\r\n/g, '\n');
const cut = (sql, start, end) => { const from = sql.indexOf(start); assert.ok(from >= 0, `missing ${start}`); const to = sql.indexOf(end, from); assert.ok(to > from, `unterminated ${start}`); return sql.slice(from, to + end.length); };
const db = new PGlite();
let passed = 0;
const check = (ok, label) => { assert.ok(ok, label); passed++; console.log(`PASS ${label}`); };
const youth = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', company = '33333333-3333-4333-8333-333333333333', job = '44444444-4444-4444-8444-444444444444';
const as = async (id, run) => {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${id}"}',true);`);
  try { const result = await run(); await db.exec('commit'); return result; } catch (error) { await db.exec('rollback'); throw error; }
};
const fails = async (run, code) => { try { await run(); } catch (error) { return error.code === code; } return false; };

await db.exec(`
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth; create schema private;
grant usage on schema auth,private,public to authenticated,anon,service_role;
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create table public.profiles(id uuid primary key, role text);
create table public.youth_profiles(user_id uuid primary key references public.profiles(id), full_name text, age integer, city text, address text, postal_code text,
  cv_text text, cv_structured jsonb, documents jsonb, work_experience jsonb, education jsonb, languages jsonb, employment_preferences jsonb, certificates jsonb, extracurriculars jsonb, updated_at timestamptz);
create table public.jobs(id uuid primary key, title text, company_name text);
create table public.employment_records(match_id uuid, youth_user_id uuid, company_name text, role_name text, start_date date, response text, show_on_profile boolean, include_in_cv boolean);
alter table public.youth_profiles enable row level security;
create policy own_read on public.youth_profiles for select to authenticated using(user_id=auth.uid());
create policy own_update on public.youth_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on public.youth_profiles to authenticated; grant select on public.profiles to authenticated;
create function public.valid_job_category_ids(p_ids text[]) returns boolean language sql immutable as $$select true$$;
`);
const progressive = file('20261012124134_progressive_recruitment_profile.sql'), flexible = file('20261012143326_flexible_profiles_and_relevant_followups.sql');
const n17 = file('20261018174543_n17_job_categories.sql'), n19 = file('20261019155114_n19_application_disclosures.sql'), conflicts = file('20261105164023_n19_n02_http_conflicts.sql');
await db.exec(cut(flexible, 'create or replace function public.valid_recruitment_profile(p jsonb)', 'end; $$;'));
await db.exec(cut(progressive, 'alter table public.youth_profiles add column if not exists recruitment_profile jsonb', 'for each row execute function private.version_recruitment_profile();'));
await db.exec(cut(n17, 'do $migration$', 'end; $migration$;'));
await db.exec(cut(conflicts, 'CREATE OR REPLACE FUNCTION public.save_my_recruitment_profile', '$function$;'));
await db.exec('grant execute on function public.save_my_recruitment_profile(text,jsonb,integer) to authenticated;');
await db.exec(cut(n19, 'create function private.disclosed_cv_facts', '$$;'));
await db.exec(cut(n19, 'create function private.build_application_disclosure', 'revoke all on function private.build_application_disclosure(uuid,uuid,text[]) from public,anon,authenticated;'));
await db.exec(`
insert into public.profiles values('${youth}','youth'),('${other}','youth'),('${company}','company');
insert into public.youth_profiles(user_id,full_name,age,city,address,postal_code,cv_text,cv_structured,documents) values
 ('${youth}','QA Ungdom',17,'Göteborg','Testgatan 12','41101','Fiktivt CV','{}','[]'),('${other}','QA Annan',18,'Malmö',null,null,'','{}','[]');
insert into public.jobs values('${job}','QA butiksjobb','QA Företag AB');
`);
const before = (await db.query(`select pg_get_functiondef('private.build_application_disclosure(uuid,uuid,text[])'::regprocedure) d`)).rows[0].d;

const migration = file('20261112150000_f12_n19_saved_profile_answers.sql');
await db.exec(migration);
check(true, 'migration applies on top of the repository definitions');
const after = (await db.query(`select pg_get_functiondef('private.build_application_disclosure(uuid,uuid,text[])'::regprocedure) d`)).rows[0].d;
check(after.length > before.length && after.replace(/ for pair in select value,ordinality-1 as idx from jsonb_array_elements\(coalesce\(r->'savedAnswers'[\s\S]*? end loop;\n/, '') === before, 'disclosure builder differs only by the saved-answer option loop');
check(await fails(() => db.exec(migration), '42723') || await fails(() => db.exec(migration), 'P0001'), 'a second run stops instead of patching twice');
const acl = (await db.query(`select has_function_privilege('anon','public.valid_saved_profile_answers(jsonb)','execute') anon, has_function_privilege('authenticated','public.valid_saved_profile_answers(jsonb)','execute') auth, has_function_privilege('authenticated','private.build_application_disclosure(uuid,uuid,text[])','execute') build`)).rows[0];
check(!acl.anon && acl.auth && !acl.build, 'validator is not callable by anon and the private builder stays closed');

const base = { availability: { days: [], periods: [], startDate: '', hours: '' }, preferences: { roles: [], locations: [], travelMinutes: '', motivation: 'Vill lära mig' }, examples: [], qualifications: { licences: [], tools: [], languages: [] } };
const answer = (n = 0, extra = {}) => ({ text: `Jag har B-körkort sedan i våras ${n}`, question: 'Vad vill du lägga till om ”B-körkort”?', savedAt: '2026-11-12', source: `${job}:followup:${n}`, ...extra });
const valid = async profile => (await db.query('select public.valid_recruitment_profile($1::jsonb) ok', [JSON.stringify(profile)])).rows[0].ok;
check(await valid(base), 'profile without saved answers is still valid');
check(await valid({ ...base, savedAnswers: [] }) && await valid({ ...base, savedAnswers: [answer(1), answer(2)] }), 'empty and filled saved answers are valid');
check(await valid({ ...base, savedAnswers: Array.from({ length: 8 }, (_, n) => answer(n)) }) && !await valid({ ...base, savedAnswers: Array.from({ length: 9 }, (_, n) => answer(n)) }), 'at most eight saved answers');
const bad = [
  ['not an array', {}], ['missing key', [{ text: 'a', question: 'b', savedAt: '2026-11-12' }]], ['extra key', [answer(0, { note: 'x' })]],
  ['empty text', [answer(0, { text: '  ' })]], ['long text', [answer(0, { text: 'a'.repeat(601) })]], ['long question', [answer(0, { question: 'q'.repeat(301) })]],
  ['impossible date', [answer(0, { savedAt: '2026-02-30' })]], ['date format', [answer(0, { savedAt: '12/11/2026' })]], ['non-string text', [answer(0, { text: 5 })]],
  ['duplicate source', [answer(1), answer(1)]], ['long source', [answer(0, { source: 's'.repeat(121) })]],
];
for (const [label, value] of bad) check(!await valid({ ...base, savedAnswers: value }), `rejected: ${label}`);
check(!await valid({ ...base, other: [] }) && !await valid({ ...base, savedAnswers: [], other: 1 }), 'unknown top-level keys are still rejected');
const { examples, ...withoutExamples } = base; void examples;
check(!await valid({ ...withoutExamples, savedAnswers: [] }), 'savedAnswers cannot replace a required section');
check(!await valid({ ...base, preferences: { ...base.preferences, motivation: 'm'.repeat(1001) }, savedAnswers: [answer(0)] }), 'original field limits still apply next to saved answers');
check(await valid({ ...base, preferences: { ...base.preferences, categoryIds: [] }, savedAnswers: [answer(0)] }), 'N17 category ids remain accepted');

const save = (id, section, value, version) => as(id, () => db.query('select public.save_my_recruitment_profile($1,$2::jsonb,$3) r', [section, JSON.stringify(value), version]));
const first = (await save(youth, 'savedAnswers', [answer(1)], 0)).rows[0].r;
check(first.version === 1 && first.profile.savedAnswers.length === 1 && first.profile.preferences.motivation === '', 'owner saves the new section and the version increases');
check(await fails(() => save(youth, 'savedAnswers', [answer(1), answer(2)], 0), 'PT409'), 'stale version gives PT409 and saves nothing');
check(await fails(() => save(company, 'savedAnswers', [answer(1)], 0), '42501'), 'company account is refused');
check(await fails(() => save(youth, 'savedAnswers', [answer(1, { text: '' })], 1), '22023') && await fails(() => save(youth, 'privateNotes', [], 1), '22023'), 'invalid value and unknown section give 22023');
await save(youth, 'preferences', { roles: ['Butik'], locations: [], travelMinutes: '', motivation: 'Vill lära mig' }, 1);
const row = async id => (await db.query('select recruitment_profile p, recruitment_profile_version v from public.youth_profiles where user_id=$1', [id])).rows[0];
check((await row(youth)).p.savedAnswers.length === 1 && (await row(youth)).v === 2, 'saving another section keeps the saved answers');
check((await row(other)).p.savedAnswers === undefined && (await row(other)).v === 0, 'another youth is untouched');
check(await fails(() => as(youth, () => db.query(`update public.youth_profiles set recruitment_profile=jsonb_set(recruitment_profile,'{savedAnswers}','[{"text":"x"}]') where user_id=$1`, [youth])), '23514'), 'CHECK constraint blocks an invalid direct write');
check((await as(other, () => db.query(`update public.youth_profiles set recruitment_profile=jsonb_set(recruitment_profile,'{savedAnswers}','[]') where user_id=$1 returning user_id`, [youth]))).rows.length === 0, 'RLS keeps another youth from writing the row');

const build = async (selection = []) => (await db.query('select private.build_application_disclosure($1,$2,$3::text[]) r', [job, youth, selection])).rows[0].r;
const plain = await build();
const option = plain.options.find(item => item.key === 'answer:0');
check(option && option.label === 'Sparad egen uppgift – självuppgiven' && option.text === answer(1).text && option.value === answer(1).text, 'saved answer is offered as an optional sharing item');
check(!JSON.stringify(option).includes('followup') && !JSON.stringify(option).includes('Vad vill du'), 'the option carries neither the original question nor its source');
check(plain.packet.profile_items.length === 0 && !JSON.stringify(plain.packet).includes('B-körkort'), 'nothing is shared with the company by default');
check(plain.matching_input.recruitment_profile.savedAnswers[0].text === answer(1).text, 'internal matching input contains the saved answer');
const chosen = await build(['answer:0']);
check(chosen.packet.profile_items.length === 1 && chosen.packet.profile_items[0].text === answer(1).text, 'explicitly selected answer is part of the shared packet');
check(await fails(() => build(['answer:5']), '22023'), 'a selection key that does not exist is refused');
await save(youth, 'savedAnswers', [answer(1, { text: 'Jag bor på Testgatan 12 och har B-körkort' })], 2);
const changed = await build(['answer:0']);
check(changed.source_token !== plain.source_token, 'changing a saved answer changes the source token, so an old approval cannot be reused');
check(changed.packet.profile_items[0].value === null && !changed.packet.profile_items[0].text.includes('Testgatan'), 'a saved answer containing the home address is withheld from the shared packet');
await save(youth, 'savedAnswers', [], 3);
check((await build()).options.every(item => !item.key.startsWith('answer:')) && await fails(() => build(['answer:0']), '22023'), 'a removed answer can no longer be offered or selected');
console.log(`saved-answers postgres: ${passed} checks passed`);
