// Real DevStaging Auth/Data/Storage; run actual product readers/writers without a browser.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { createCanvas } from '@napi-rs/canvas';

const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, base);
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(key);
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claims.ref, 'vwcfjvwfeatvuisojwrh'); assert.equal(claims.role, 'anon');
}
const prefix = `qa-workplaces-${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = randomBytes(24).toString('base64url'), accounts = [], jobIds = [];
let selected, checks = 0, step = 'setup';
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`PASS ${label}`); };
const require = createRequire(import.meta.url), originalLoad = Module._load;
Module._extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
// Only the application singleton is supplied by the harness. Auth, ownership,
// projections, geocoding fallback, copy allowlist and SDK transport are real.
Module._load = function (name, parent, ...rest) {
  if (name === '@/lib/supabase') return { getSupabaseClient: () => selected };
  return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest);
};
const { createJob, updateJob, getJobById } = require('../lib/jobs.ts');
const { loadOwnJobCopy } = require('../lib/job-copy-client.ts');
const { uploadJobImage } = require('../lib/storage.ts');
const { validateDraftPublication } = require('../lib/job-copy.ts');
const { JobWorkplaceConflictError } = require('../lib/job-workplaces.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const places = [
  { id: randomUUID(), name: 'QA City', address: 'QA Testgatan 1', postal_code: '11122', city: 'Stockholm', longitude: 18.06, latitude: 59.33 },
  { id: randomUUID(), name: 'QA Väst', address: 'QA Testgatan 2', postal_code: '41101', city: 'Göteborg', longitude: 11.97, latitude: 57.7 },
];
try {
  for (const role of ['company', 'company', 'youth']) {
    const c = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) }) } });
    const signed = await c.auth.signUp({ email: `${prefix}-${accounts.length}@example.invalid`, password, options: { data: { role } } });
    if (signed.data.user?.id) accounts.push({ c, id: signed.data.user.id, token: signed.data.session?.access_token });
    check(!signed.error && !!signed.data.session, `actual ${role} test session`);
    writeFileSync('/tmp/mnw-workplace-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id), jobs: jobIds }));
  }
  const [owner, other, youth] = accounts; selected = owner.c;
  const p = await owner.c.from('company_profiles').update({ company_name: `QA ${prefix}`, administrator: 'QA Testkontakt', organization_number: '000000-0000' }).eq('user_id', owner.id); assert.ok(!p.error);
  await assert.rejects(createJob({ title: 'QA wrong owner', description: 'QA', city: 'Stockholm', address: 'QA Gatan', salary_per_hour: '', employment_type: 'Deltid' }, other.id), /Kontot har ändrats/);
  check(true, 'real Auth rejects publication bound to another form owner before any job write');
  const image = createCanvas(1200, 900); image.getContext('2d').fillRect(0, 0, 1200, 900);
  const bytes = image.toBuffer('image/png');
  step = 'image and real product creation';
  const imageUrl = await uploadJobImage(new File([bytes], 'qa-workplace-fixture.png', { type: 'image/png' }));
  check(imageUrl.includes(`/job-images/${owner.id}/`), 'product uploads reviewed fixture under correct owner');
  const title = `QA WORKPLACES ${prefix} – EJ RIKTIGT JOBB`;
  const job = await createJob({ title, description: 'Fiktivt tekniskt QA-test. Ingen verklig rekrytering.', city: places[0].city, workplaces: places,
    salary_per_hour: '130–150 kr/tim', employment_type: 'Deltid', requirements: 'Publikt krav', benefits: 'QA introduktion', image_url: imageUrl }, owner.id);
  jobIds.push(job.id);
  writeFileSync('/tmp/mnw-workplace-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id), jobs: jobIds }));
  check(job.workplaces.length === 2 && job.address === places[0].address && job.city === places[0].city && job.longitude === places[0].longitude, 'both workplaces and primary location survive real insertion');
  check(job.open_positions === 1 && job.publication_status === 'pending_verification', 'no required position input and pending company remains unpublished');
  const downloaded = await owner.c.storage.from('job-images').download(imageUrl.split('/object/public/job-images/')[1]); assert.ok(!downloaded.error);
  check(hash(Buffer.from(await downloaded.data.arrayBuffer())) === hash(bytes), 'real stored image has identical bytes');
  const criteria = await owner.c.from('job_match_profiles').insert({ job_id: job.id, status: 'draft', role_summary: 'Intern QA-roll', must_haves: ['Svenska'], trainable_requirements: ['Kassa'], top_traits: ['Noggrann'], candidate_questions: [{ id: 'q1', question: 'QA när kan du börja?', answer_type: 'text' }] }); assert.ok(!criteria.error, `criteria ${criteria.error?.code}`);
  step = 'copy all lifecycle states';
  let copy;
  for (const status of ['active', 'paused', 'closed']) {
    if (status === 'closed') {
      const closed = await owner.c.rpc('recruitment_action', { p_action: 'close_job', p_match_id: null, p_payload: { job_id: job.id, outcome: 'no_hire' } });
      assert.ok(!closed.error, `close QA recruitment ${closed.error?.code}`);
    } else await updateJob(job.id, { status });
    const source = await getJobById(job.id);
    const before = await owner.c.from('jobs').select('*').eq('id', job.id).single(); assert.ok(!before.error);
    copy = await loadOwnJobCopy(job.id);
    check(copy.title === title && copy.salaryText === '130–150 kr/tim' && !copy.copyReviewed && copy.copiedFromTitle === title, `${status} copy preserves reviewed fields but requires new review`);
    check(copy.workplaces.length === 2 && copy.workplaces.every(p => !places.some(s => s.id === p.id)), `${status} copy has fresh independent workplace IDs`);
    check(copy.listingRequirements === 'Publikt krav' && copy.requirements === 'Svenska' && copy.imageUrls[0] === imageUrl, `${status} copy separates public/internal requirements and retains saved image`);
    assert.throws(() => validateDraftPublication(copy), /Granska kopians/);
    const after = await owner.c.from('jobs').select('*').eq('id', job.id).single(); assert.ok(!after.error);
    check(JSON.stringify(before.data) === JSON.stringify(after.data) && source.status === status, `${status} copying leaves the entire original database row untouched`);
  }
  step = 'new copy and original independence';
  copy.copyReviewed = true; validateDraftPublication(copy);
  const createdCopy = await createJob({ title: `${title} KOPIA`, description: copy.description, city: copy.city, workplaces: copy.workplaces,
    salary_per_hour: copy.salaryText, employment_type: copy.employmentType, requirements: copy.listingRequirements, image_url: copy.imageUrls.join(',') }, owner.id);
  jobIds.push(createdCopy.id);
  writeFileSync('/tmp/mnw-workplace-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id), jobs: jobIds }));
  const preserved = await getJobById(job.id);
  check(createdCopy.id !== job.id && createdCopy.status === 'active' && preserved.status === 'closed' && preserved.title === title, 'copy is a separate recruitment while closed original remains closed');

  step = 'stale workplace editor and concurrent saves';
  const baseline = createdCopy.workplaces;
  const a = baseline.map((p, i) => i ? p : { ...p, name: 'QA concurrent A' });
  const b = baseline.map((p, i) => i ? p : { ...p, name: 'QA concurrent B' });
  const started = Date.now();
  const competition = await Promise.allSettled([
    updateJob(createdCopy.id, { workplaces: a }, { expectedWorkplaces: baseline }),
    updateJob(createdCopy.id, { workplaces: b }, { expectedWorkplaces: baseline }),
  ]);
  check(competition.filter(r => r.status === 'fulfilled').length === 1 && competition.find(r => r.status === 'rejected')?.reason instanceof JobWorkplaceConflictError && Date.now() - started < 20000, 'two real same-baseline edits yield one winner and bounded conflict');
  const winner = competition.find(r => r.status === 'fulfilled').value;
  check(JSON.stringify((await getJobById(createdCopy.id)).workplaces) === JSON.stringify(winner.workplaces), 'losing real update cannot overwrite saved workplace winner');
  await assert.rejects(updateJob(createdCopy.id, { workplaces: baseline }, { expectedWorkplaces: baseline }), JobWorkplaceConflictError);
  check(true, 'stale later retry also fails without overwriting winner');
  await updateJob(createdCopy.id, { title: `${title} KOPIA UPPDATERAD` });
  const refreshed = await updateJob(createdCopy.id, { workplaces: winner.workplaces.map((p, i) => i ? p : { ...p, name: 'QA freshly reviewed' }) }, { expectedWorkplaces: winner.workplaces });
  check(refreshed.title.endsWith('UPPDATERAD') && refreshed.workplaces[0].name === 'QA freshly reviewed', 'fresh workplace retry preserves unrelated newer title');
  const removed = await updateJob(createdCopy.id, { workplaces: [refreshed.workplaces[1]] }, { expectedWorkplaces: refreshed.workplaces });
  check(removed.workplaces.length === 1 && removed.city === 'Göteborg' && removed.address === places[1].address && removed.longitude === places[1].longitude, 'removing primary workplace promotes second address and coordinates atomically');
  const empty = await owner.c.from('jobs').update({ workplaces: [] }).eq('id', createdCopy.id);
  check(!!empty.error && (await getJobById(createdCopy.id)).workplaces.length === 1, 'actual database rejects removing final workplace');
  const duplicate = await owner.c.from('jobs').update({ workplaces: [removed.workplaces[0], removed.workplaces[0]] }).eq('id', createdCopy.id);
  check(!!duplicate.error, 'actual database rejects duplicate workplace identifiers');

  if (process.env.MNW_WORKPLACE_PREFERENCES === '1') {
    step = 'guarded QA verification';
    await updateJob(job.id, { status: 'active' });
    writeFileSync('/tmp/mnw-workplace-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id), jobs: jobIds, company: owner.id, reviewer: youth.id, name: `QA ${prefix}` }));
    console.log('PHASE waiting for guarded QA employer verification');
    const until = Date.now() + 240000; let verified = false;
    while (Date.now() < until) {
      if (existsSync('/tmp/mnw-workplace-seeded.json')) {
        const seed = JSON.parse(readFileSync('/tmp/mnw-workplace-seeded.json', 'utf8'));
        if (seed.prefix === prefix && seed.verified === true) { verified = true; break; }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(verified, 'QA verification missing; not a passed test');
    const companyState = await owner.c.from('company_profiles').select('verification_status').eq('user_id', owner.id).single();
    assert.ok(!companyState.error && companyState.data.verification_status === 'verified', 'Operator marker is not proof of actual company verification');
    const youthBasic = await youth.c.from('youth_profiles').update({ full_name: 'QA Arbetsplats Testsson', age: 18, city: 'QA Teststad',
      short_onboarding_completed: true, cv_text: 'Fiktivt QA-CV. Ingen riktig ansökan eller rekrytering.', cv_generated: true }).eq('user_id', youth.id);
    assert.ok(!youthBasic.error, `youth fixture ${youthBasic.error?.code}`);
    const draft = await youth.c.from('youth_application_drafts').insert({ job_id: job.id, youth_user_id: youth.id }); assert.ok(!draft.error, `private application ${draft.error?.code}`);
    const choose = workplaceId => youth.c.from('application_workplace_preferences').upsert({ job_id: job.id, youth_user_id: youth.id, workplace_id: workplaceId }, { onConflict: 'job_id,youth_user_id' }).select('workplace_snapshot').single();
    const choice = await choose(places[1].id); assert.ok(!choice.error, `preference ${choice.error?.code}`);
    check(choice.data.workplace_snapshot.address === places[1].address, 'real preference snapshot is populated by server');
    const hidden = await owner.c.from('application_workplace_preferences').select('workplace_snapshot').eq('job_id', job.id).eq('youth_user_id', youth.id);
    check(!hidden.error && hidden.data.length === 0, 'company cannot see private preference before submitted application');
    const prepared = await youth.c.rpc('prepare_my_application', { p_job_id: job.id, p_notify: false });
    assert.ok(!prepared.error && prepared.data?.status === 'submitted', `actual QA application ${prepared.error?.code}`);
    const shared = await owner.c.from('application_workplace_preferences').select('workplace_snapshot').eq('job_id', job.id).eq('youth_user_id', youth.id).single();
    check(!shared.error && shared.data.workplace_snapshot.id === places[1].id, 'right company can read voluntarily chosen workplace after submission');
    const foreignPreference = await other.c.from('application_workplace_preferences').select('workplace_snapshot').eq('job_id', job.id);
    check(!foreignPreference.error && foreignPreference.data.length === 0, 'other company cannot read applicant workplace preference');
    const current = await getJobById(job.id);
    const remaining = await updateJob(job.id, { workplaces: [{ ...current.workplaces[0], address: 'QA NY GATA 99', longitude: null, latitude: null }] }, { expectedWorkplaces: current.workplaces });
    const history = await owner.c.from('application_workplace_preferences').select('workplace_snapshot').eq('job_id', job.id).eq('youth_user_id', youth.id).single();
    check(!history.error && history.data.workplace_snapshot.id === places[1].id && history.data.workplace_snapshot.address === places[1].address, 'removing selected workplace preserves historical applicant snapshot');
    const invalid = await choose(places[1].id);
    check(!!invalid.error, 'fresh preference cannot choose removed workplace');
    const changed = await choose(remaining.workplaces[0].id);
    check(!changed.error && changed.data.workplace_snapshot.address === 'QA NY GATA 99', 'explicit new choice gets the current server address');
    const withdrawn = await youth.c.rpc('withdraw_my_application', { p_job_id: job.id, p_expected_submitted: true }); assert.ok(!withdrawn.error);
    const inaccessible = await owner.c.from('application_workplace_preferences').select('workplace_snapshot').eq('job_id', job.id).eq('youth_user_id', youth.id);
    check(!inaccessible.error && inaccessible.data.length === 0, 'withdrawal ends fresh company preference access');
    const afterWithdrawal = await choose(remaining.workplaces[0].id);
    check(!!afterWithdrawal.error, 'withdrawn application cannot make a new workplace choice');
  }

  step = 'negative real authorization';
  for (const account of [other, youth]) {
    selected = account.c;
    const read = await account.c.from('jobs').select('id').eq('id', job.id); assert.ok(!read.error);
    check(read.data.length === (process.env.MNW_WORKPLACE_PREFERENCES === '1' ? 1 : 0), process.env.MNW_WORKPLACE_PREFERENCES === '1' ? 'foreign account sees only normally published original content' : 'foreign account cannot read pending original');
    await assert.rejects(loadOwnJobCopy(job.id), /egna annonser|Logga in som företag/);
    check(true, 'product copy reader rejects foreign or youth account');
    const forbidden = await account.c.from('jobs').update({ workplaces: places }).eq('id', job.id).select('id');
    check(!!forbidden.error || forbidden.data.length === 0, 'direct foreign Data API cannot update workplaces');
  }
  selected = owner.c;
  const state = await owner.c.from('jobs').select('id').eq('company_user_id', owner.id);
  check(!state.error && state.data.length === 2, 'exactly two own QA jobs exist after all copy/conflict operations');
  console.log(JSON.stringify({ prefix, checks, result: 'PASS', fixtureIds: accounts.map(a => a.id), jobs: jobIds }));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', step, checks, error: error.message.slice(0, 600) })); process.exitCode = 1;
} finally {
  Module._load = originalLoad;
  const remaining = [];
  for (const account of accounts) {
    if (!account.token) { remaining.push(account.id); continue; }
    try {
      const result = await fetch('https://youth-job-mvp-dev.vercel.app/api/account', { method: 'DELETE', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password, expectedUserId: account.id }), signal: AbortSignal.timeout(45000) });
      if (!result.ok) remaining.push(account.id);
    } catch { remaining.push(account.id); }
  }
  console.log(JSON.stringify({ cleanup: remaining.length ? 'FAILED' : 'PASS', remainingFixtureIds: remaining }));
  if (remaining.length) process.exitCode = 1;
}
