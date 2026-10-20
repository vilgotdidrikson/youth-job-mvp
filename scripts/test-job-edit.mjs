import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const load = Module._load;
const alias = (request, parent, rest, self) => load.call(self, request.startsWith('@/') ? path.resolve(request.slice(2)) : request, parent, ...rest);
Module._load = function (request, parent, ...rest) { return alias(request, parent, rest, this); };
const { createEditJobDraft, jobEditUpdates, jobEditCriteria, jobEditCriteriaChanged, withSavedPublicFields, jobEditVisibility, jobEditReceipt, JOB_EDIT_CONSEQUENCES } = require('../lib/job-edit.ts');
const { createCopyJobDraft } = require('../lib/job-copy.ts');
Module._load = load;

const places = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'City', address: 'Gatan 1', postal_code: '11111', city: 'Stockholm', longitude: 18, latitude: 59 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Väst', address: 'Gatan 2', postal_code: '22222', city: 'Göteborg', longitude: 12, latitude: 58 },
];
const job = { id: 'job-1', title: 'QA Butikssäljare', description: 'QA beskrivning', company_user_id: 'company-a', company_name: 'QA AB', city: 'Stockholm', address: 'Gatan 1', postal_code: '11111', longitude: 18, latitude: 59, workplaces: places, salary_per_hour: '135 kr/tim', employment_type: 'Deltid', category: 'Butik', job_category_ids: [], job_category_manual: false, requirements: 'Publikt krav', benefits: 'Introduktion', image_url: 'https://example.invalid/a.jpg', status: 'active', is_active: true, publication_status: 'published', min_age: 16, max_age: 24 };
const criteria = { job_id: job.id, role_summary: 'Intern rollbeskrivning', must_haves: ['Kan arbeta helger'], trainable_requirements: ['Kassa'], top_traits: ['Noggrann'], candidate_questions: [{ id: 'q1', question: 'När kan du börja?' }], profile_version: 4 };

// Editing keeps workplace identity (applicant preferences point at it); copying still gets fresh IDs.
const draft = createEditJobDraft(job, criteria);
assert.deepEqual(draft.workplaces.map(place => place.id), places.map(place => place.id));
assert.equal(draft.copiedFromTitle, '');
assert.notEqual(createCopyJobDraft(job, criteria, () => 'fresh').workplaces[0].id, places[0].id);
assert.equal(draft.listingRequirements, 'Publikt krav');
assert.equal(draft.requirements, 'Kan arbeta helger');
for (const field of ['id', 'company_user_id', 'status', 'is_active', 'publication_status', 'profile_version']) assert.ok(!(field in draft), field);

// Nothing changed: nothing is sent and criteria are not re-versioned.
assert.deepEqual(jobEditUpdates(draft, structuredClone(draft), draft.imageUrls), {});
assert.equal(jobEditCriteriaChanged(draft, structuredClone(draft)), false);
assert.equal(jobEditCriteriaChanged(draft, { ...draft, aiGenerated: true }), false); // A flag alone is not a criteria change.

// Only changed public fields are sent; location fields stay out so nothing is geocoded again.
assert.deepEqual(jobEditUpdates(draft, { ...draft, title: 'QA Kassabiträde' }, draft.imageUrls), { title: 'QA Kassabiträde' });
assert.deepEqual(jobEditUpdates(draft, { ...draft, salaryText: '' , salaryFrom: '140' }, draft.imageUrls), { salary_per_hour: 'Från 140 kr/tim' });
assert.deepEqual(jobEditUpdates(draft, { ...draft, minAge: '', maxAge: '' }, draft.imageUrls), { min_age: null, max_age: null });
assert.deepEqual(jobEditUpdates(draft, { ...draft, listingRequirements: 'Nytt publikt krav' }, draft.imageUrls), { requirements: 'Nytt publikt krav' });
assert.deepEqual(jobEditUpdates(draft, draft, ['https://example.invalid/b.jpg']), { image_url: 'https://example.invalid/b.jpg' });
assert.deepEqual(jobEditUpdates(draft, { ...draft, imageUrls: [] }, []), { image_url: '' });
const moved = { ...draft, workplaces: [{ ...places[0], address: 'Ny gata 3' }, places[1]] };
const workplaceUpdate = jobEditUpdates(draft, moved, draft.imageUrls);
assert.deepEqual(Object.keys(workplaceUpdate), ['workplaces']);
assert.equal(workplaceUpdate.workplaces[0].id, places[0].id);
assert.equal(workplaceUpdate.workplaces[0].address, 'Ny gata 3');
// Internal criteria edits never leak into the public listing columns.
const criteriaOnly = { ...draft, requirements: 'Kan arbeta helger, B-körkort', topTraits: 'Noggrann, Social' };
assert.deepEqual(jobEditUpdates(draft, criteriaOnly, draft.imageUrls), {});
assert.equal(jobEditCriteriaChanged(draft, criteriaOnly), true);
assert.deepEqual(jobEditCriteria(criteriaOnly, job.id).mustHaves, ['Kan arbeta helger', 'B-körkort']);
assert.equal(jobEditCriteria({ ...draft, matchRoleSummary: '  ' }, job.id).roleSummary, draft.description);

// Partial save: after the listing saved, a retry sends only the still-unsaved criteria.
const both = { ...criteriaOnly, title: 'QA Ny titel' };
const rebased = withSavedPublicFields(draft, both, ['https://example.invalid/c.jpg']);
assert.deepEqual(jobEditUpdates(rebased, { ...both, imageUrls: rebased.imageUrls }, rebased.imageUrls), {});
assert.equal(jobEditCriteriaChanged(rebased, both), true);

for (const [state, pattern] of [[job, /syns direkt/], [{ ...job, publication_status: 'pending_verification' }, /väntar på företagsverifiering/], [{ ...job, status: 'paused', is_active: false }, /pausad och förblir dold/], [{ ...job, status: 'closed', is_active: false }, /stängd/], [{ ...job, publication_status: undefined }, /kunde inte bekräftas/]]) assert.match(jobEditVisibility(state), pattern);
assert.ok(JOB_EDIT_CONSEQUENCES.some(text => /ansökningar, matchningar och chattar finns kvar/.test(text)));
assert.ok(JOB_EDIT_CONSEQUENCES.some(text => /görs matchningsanalysen om automatiskt/.test(text)));
assert.match(jobEditReceipt(false, false), /Inga ändringar/);
assert.match(jobEditReceipt(true, false), /^Ändringarna i annonsen är sparade\.$/);
assert.match(jobEditReceipt(true, true), /annonsen och matchkriterierna.*bedöms om/);

// The real update path: only changed columns, no status or ownership fields, owner enforced.
const writes = []; let geocoded = 0; let currentUser = 'company-a'; let role = 'company'; let switchDuringLoad = false;
const row = structuredClone(job);
const db = { from(table) { assert.equal(table, 'jobs'); let data; return { update(payload) { writes.push(structuredClone(payload)); data = { ...row, ...payload }; return this; }, select() { return this; }, eq() { return this; }, async single() { return { data, error: null }; }, async maybeSingle() { return { data: structuredClone(row), error: null }; } }; } };
Module._load = function (request, parent, ...rest) {
  if (request === '@/lib/auth') return { getCurrentUser: async () => currentUser ? { id: currentUser, email: 'qa@example.invalid' } : null, getUserProfile: async () => ({ role }) };
  if (request === '@/lib/supabase') return { getSupabaseClient: () => db };
  if (request === '@/lib/job-location') return { geocodeJobLocation: async () => { geocoded++; return { longitude: 18, latitude: 59 }; } };
  if (request === '@/lib/match-profiles') return { getJobMatchProfile: async () => { if (switchDuringLoad) currentUser = 'company-b'; return structuredClone(criteria); } };
  return alias(request, parent, rest, this);
};
try {
  const { updateJob } = require('../lib/jobs.ts');
  await updateJob(job.id, jobEditUpdates(draft, { ...draft, title: 'QA Kassabiträde', description: 'QA ny text' }, draft.imageUrls));
  assert.deepEqual(writes.at(-1), { title: 'QA Kassabiträde', description: 'QA ny text' });
  assert.equal(geocoded, 0);
  await updateJob(job.id, workplaceUpdate);
  assert.deepEqual(Object.keys(writes.at(-1)), ['workplaces']);
  assert.equal(writes.at(-1).workplaces[0].id, places[0].id);
  for (const field of ['status', 'is_active', 'publication_status', 'company_user_id', 'created_at']) assert.ok(writes.every(write => !(field in write)), field);
  const count = writes.length;
  currentUser = 'company-b';
  await assert.rejects(updateJob(job.id, { title: 'Kapad' }), /own jobs/);
  assert.equal(writes.length, count);

  const { loadOwnJobForEdit } = require('../lib/job-edit-client.ts');
  currentUser = 'company-a';
  const source = await loadOwnJobForEdit(job.id);
  assert.equal(source.form.title, job.title);
  assert.equal(source.criteria.profile_version, 4);
  currentUser = 'company-b'; await assert.rejects(loadOwnJobForEdit(job.id), /egna annonser/);
  currentUser = null; await assert.rejects(loadOwnJobForEdit(job.id), /Logga in/);
  currentUser = 'company-a'; role = 'youth'; await assert.rejects(loadOwnJobForEdit(job.id), /Logga in/);
  role = 'company'; switchDuringLoad = true; await assert.rejects(loadOwnJobForEdit(job.id), /Kontot har ändrats/);
} finally { Module._load = load; }

// Wiring: edits use their own session and the normal authorized writers, never the local create draft or createJob.
const page = readFileSync('app/company/page.tsx', 'utf8');
const saveHandler = page.slice(page.indexOf('const handleSaveJobEdit'), page.indexOf('const handleCreateJob'));
assert.match(page, /const builder = editing \? jobEdit : jobDraft;/);
assert.match(saveHandler, /updateJob\(job\.id, updates\)/);
assert.match(saveHandler, /saveJobMatchProfile\(jobEditCriteria\(form, job\.id\), jobEdit\.criteria\?\.profile_version \?\? null\)/);
assert.doesNotMatch(saveHandler, /createJob|jobDraft\.|createInitialJobMatchProfile/);
assert.match(page, /Redigera annons<\/button>/);
const { companyView, editCompanyJobHref } = require('../lib/company-navigation.ts');
assert.equal(companyView('redigera'), 'redigera');
assert.equal(editCompanyJobHref('qa/id?x'), '/company?view=redigera&edit=qa%2Fid%3Fx');
console.log('PASS job edit: kept workplace IDs, changed-fields-only payload without re-geocoding, public/internal separation, criteria change detection, partial-save retry, visibility and consequence texts, owner/session checks and isolated edit wiring.');
