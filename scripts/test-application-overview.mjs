import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { applicationCounts, activityWithoutApplication, isUnsent, pendingInterestView, savedInterestAction } = require('../lib/application-overview.ts');

// The Alla counter equals every card shown under Alla, including saved interest.
const items = [
  { job_id: 'job-questions', status: 'submitted' },
  { job_id: 'job-sent', status: 'submitted' },
  { job_id: 'job-legacy', status: 'needs_completion' },
];
const activity = [
  { jobId: 'job-sent', status: 'submitted', title: 'QA', company: 'QA', createdAt: '3' },
  { jobId: 'job-draft', status: 'draft', available: true, title: 'QA', company: 'QA', createdAt: '2' },
  { jobId: 'job-closed', status: 'draft', available: false, title: 'Jobbannons', company: 'Arbetsgivare', createdAt: '1' },
  { jobId: 'job-matched', status: 'matched', title: 'QA', company: 'QA', createdAt: '0' },
];
const needsAnswers = (item) => item.job_id === 'job-questions';
assert.deepEqual(activityWithoutApplication(activity, items).map((stage) => stage.jobId), ['job-draft', 'job-closed', 'job-matched']);
assert.deepEqual(applicationCounts(items, activity, needsAnswers), { all: 6, unsent: 3, questions: 1 });
assert.deepEqual(applicationCounts([], [], needsAnswers), { all: 0, unsent: 0, questions: 0 });
// Saved interest alone (CV not finished) is counted; before F13 the counter showed 0.
assert.equal(applicationCounts([], [activity[1]], needsAnswers).all, 1);
assert.equal(isUnsent(activity[1]), true);
assert.equal(isUnsent(activity[3]), false);
assert.equal(isUnsent(items[2]), true);
assert.equal(isUnsent(items[0]), false);

// Saved interest is never presented as sent, and states what sending requires.
const noCv = pendingInterestView({ available: true }, false);
assert.equal(noCv.label, 'Inte skickad ännu');
assert.equal(noCv.action, 'complete_cv');
assert.equal(noCv.showJobLink, true);
assert.match(noCv.body, /inte skickat till företaget/);
assert.match(noCv.body, /skickas automatiskt när ditt CV är sparat/);
assert.match(noCv.body, /annonsen är öppen/);
const cvDone = pendingInterestView({ available: true }, true);
assert.equal(cvDone.action, 'send');
assert.match(cvDone.body, /inte skickats/);
const checking = pendingInterestView({ available: true }, null);
assert.equal(checking.action, 'checking');
assert.equal(checking.showJobLink, true);
// A closed listing gives no CV push and no dead job link.
for (const cv of [true, false, null]) {
  const closed = pendingInterestView({ available: false }, cv);
  assert.equal(closed.action, 'none');
  assert.equal(closed.showJobLink, false);
  assert.match(closed.body, /skickas inte/);
}
for (const view of [noCv, cvDone, checking]) assert.doesNotMatch(view.label, /^Skickad/);
assert.deepEqual([savedInterestAction(false).kind, savedInterestAction(false).label], ['complete_cv', 'Gör klart CV:t']);
assert.deepEqual([savedInterestAction(true).kind, savedInterestAction(true).label], ['send', 'Skicka ansökan']);
for (const cv of [true, false]) assert.match(savedInterestAction(cv).note, /sparat men inte skickat/);

// Availability comes from the listing as RLS lets the youth read it.
const tables = {
  youth_application_drafts: [
    { job_id: 'open', created_at: '5', jobs: { title: 'Öppen', company_name: 'QA', status: 'active', is_active: true, publication_status: 'published' } },
    { job_id: 'hidden', created_at: '4', jobs: null },
    { job_id: 'paused', created_at: '3', jobs: [{ title: 'Pausad', company_name: 'QA', status: 'paused', is_active: false, publication_status: 'published' }] },
    { job_id: 'waiting', created_at: '2', jobs: { title: 'Väntar', company_name: 'QA', status: 'active', is_active: true, publication_status: 'pending_verification' } },
    { job_id: 'later-sent', created_at: '1', jobs: { title: 'Skickad', company_name: 'QA', status: 'active', is_active: true, publication_status: 'published' } },
  ],
  swipe_actions: [{ job_id: 'later-sent', created_at: '6', jobs: { title: 'Skickad', company_name: 'QA' } }],
  application_completions: [], matches: [], application_followups: [],
};
const selects = {};
const client = { from(table) { const query = { select(columns) { selects[table] = columns; return query; }, eq() { return query; }, order() { return query; }, limit() { return query; }, then(resolve) { resolve({ data: tables[table], error: null }); } }; return query; } };
const load = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === '@/lib/supabase') return { getSupabaseClient: () => client };
  return load.call(this, request, parent, ...rest);
};
try {
  const { getYouthActivity } = require('../lib/youth-activity.ts');
  const result = Object.fromEntries((await getYouthActivity('youth-a')).map((stage) => [stage.jobId, stage]));
  assert.match(selects.youth_application_drafts, /status,is_active,publication_status/);
  assert.equal(result.open.available, true);
  assert.equal(result.hidden.available, false);
  assert.equal(result.hidden.title, 'Jobbannons');
  assert.equal(result.paused.available, false);
  assert.equal(result.waiting.available, false);
  // A later real interest wins over the draft and is not marked as saved interest.
  assert.equal(result['later-sent'].status, 'submitted');
  assert.equal(result['later-sent'].available, undefined);
} finally { Module._load = load; }

// Wiring: tabs use the shared counts and the job page no longer re-offers "Jag är intresserad" for saved interest.
const page = readFileSync('app/applications/page.tsx', 'utf8');
assert.match(page, /Alla <span>\{counts\.all\}<\/span>/);
assert.match(page, /Inte skickade <span>\{counts\.unsent\}<\/span>/);
assert.match(page, /pendingInterestView\(stage, cvCompleted\)/);
assert.match(page, /prepareApplication\(jobId\)/);
assert.doesNotMatch(page, /Alla <span>\{items\.length\}/);
const jobPage = readFileSync('app/jobb/[jobId]/page.tsx', 'utf8');
assert.match(jobPage, /const savedInterest = hasDraft && !alreadyApplied && !needsCompletion && acceptsApplications/);
assert.ok(jobPage.indexOf('savedInterest?.kind === "complete_cv"') < jobPage.lastIndexOf('"Jag är intresserad"'));
console.log('PASS application overview: counter matches every Alla card, unsent category, saved interest never shown as sent, send requirements, closed listings, CV-complete send action, listing availability via RLS-visible join and job page button state.');
