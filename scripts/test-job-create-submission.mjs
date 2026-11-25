import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('app/company/page.tsx', 'utf8');
const ast = ts.createSourceFile('company.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleCreateJob') handler = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(handler);
const code = ts.transpileModule(`return (${handler});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(overrides = {}) {
  const calls = { checked: 0, uploads: 0, created: [], cleared: [], profiles: 0, navigation: [], errors: [] };
  const pending = deferred();
  const form = { title: 'QA kopia', description: 'QA beskrivning', workplaces: [{ id: 'qa-place' }], city: 'QA stad', address: 'QA gatan', postalCode: '11122', category: '', employmentType: 'Deltid', listingRequirements: 'Publikt krav', requirements: 'Internt krav', benefits: '', imageUrls: [], minAge: '', maxAge: '', matchRoleSummary: '', trainableRequirements: '', topTraits: '', candidateQuestions: [], practical: {}, aiGenerated: false };
  const context = {
    createLock: { current: false }, busy: false, copyingJob: null, user: { id: 'qa-company', email: 'qa@example.invalid' }, draftHydrated: true,
    jobDraft: { conflict: false, async checkCurrent() { calls.checked++; return 'qa-revision'; }, async clear(revision) { calls.cleared.push(revision); } },
    builderFormIsValid: () => true, setBusy() {}, setError: value => calls.errors.push(value),
    jobImageFiles: [], async uploadJobImage() { calls.uploads++; return 'https://example.invalid/qa.jpg'; },
    async createJob(payload, owner) { calls.created.push({ payload, owner }); return pending.promise; },
    form, formWorkplaces: value => value.workplaces, draftJobCategories: () => [], draftSalary: () => '130 kr/tim', practicalPayload: value => value,
    companyProfile: { company_name: 'QA Företag' },
    async createInitialJobMatchProfile() { calls.profiles++; }, textListItems: value => value ? value.split(',') : [],
    setAiReview() {}, async loadData() {}, createdCompanyJobHref: id => `/company?view=annonser&created=${id}`,
    window: { history: { replaceState: (...args) => calls.navigation.push(args) } },
    ...overrides,
  };
  const callback = new Function(...Object.keys(context), code)(...Object.values(context));
  return { callback, context, calls, pending };
}
const event = () => ({ preventDefault() {} });
const normal = fixture();
const first = normal.callback(event()), duplicate = normal.callback(event()); await settle();
assert.equal(normal.calls.checked, 1); assert.equal(normal.calls.created.length, 1, 'Two same-frame submissions enter creation only once');
assert.equal(normal.calls.created[0].owner, 'qa-company', 'Publication is bound to the form owner');
assert.equal(normal.calls.created[0].payload.requirements, 'Publikt krav');
assert.ok(!('open_positions' in normal.calls.created[0].payload));
normal.pending.resolve({ id: 'qa-created' }); await Promise.all([first, duplicate]);
assert.deepEqual(normal.calls.cleared, ['qa-revision']); assert.equal(normal.calls.navigation.length, 1); assert.equal(normal.context.createLock.current, false);

const conflict = fixture({ jobDraft: { conflict: false, async checkCurrent() { throw new Error('QA stale draft'); }, clear() { throw new Error('Must not clean up'); } }, jobImageFiles: [{}] });
await conflict.callback(event()); assert.equal(conflict.calls.uploads, 0); assert.equal(conflict.calls.created.length, 0); assert.equal(conflict.context.createLock.current, false);
assert.ok(conflict.calls.errors.includes('QA stale draft'));
const blocked = fixture({ jobDraft: { conflict: true }, jobImageFiles: [{}] }); await blocked.callback(event()); assert.equal(blocked.calls.created.length, 0);
const loggedOut = fixture({ user: null }); await loggedOut.callback(event()); assert.equal(loggedOut.calls.created.length, 0);

const profileFailure = fixture({ async createInitialJobMatchProfile() { throw new Error('QA criteria failed after creation'); } });
const profileResult = profileFailure.callback(event()); await settle(); profileFailure.pending.resolve({ id: 'qa-created' }); await profileResult;
assert.equal(profileFailure.calls.created.length, 1); assert.equal(profileFailure.calls.navigation.length, 1);
assert.ok(profileFailure.calls.errors.some(value => value.includes('Annonsen skapades, men matchprofilen')));
assert.deepEqual(profileFailure.calls.cleared, ['qa-revision']);
const cleanupFailure = fixture({ jobDraft: { conflict: false, async checkCurrent() { return 'qa-old'; }, async clear(revision) { assert.equal(revision, 'qa-old'); throw new Error('Newer draft exists'); } } });
const cleanupResult = cleanupFailure.callback(event()); await settle(); cleanupFailure.pending.resolve({ id: 'qa-created' }); await cleanupResult;
assert.equal(cleanupFailure.calls.created.length, 1); assert.equal(cleanupFailure.calls.navigation.length, 1);
assert.ok(cleanupFailure.calls.errors.some(value => value.includes('Publicera inte samma utkast igen')));
console.log('PASS actual create handler: same-frame duplicate guard, expected owner, no mandatory position count, draft revision before upload, correct cleanup token, stale/logged-out denial and successful creation despite criteria/cleanup warnings. Transport simulated.');
