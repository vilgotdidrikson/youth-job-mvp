import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { File } from 'node:buffer';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { EMPTY_JOB_FORM } = require('../lib/job-copy.ts');
const { JobDraftStore, jobDraftSnapshot, readLegacyJobDraft } = require('../lib/job-drafts.ts');
const factory = new IDBFactory();
const store = new JobDraftStore(() => factory, 'qa-company-drafts');
const cropped = new File([new Uint8Array([137, 80, 78, 71, 7, 19])], 'cropped-qa.png', { type: 'image/png', lastModified: 12345 });
const form = { ...EMPTY_JOB_FORM, title: 'QA café', description: 'QA public description', listingRequirements: 'Public requirement', requirements: 'Internal criterion', imagePending: true };
const initial = jobDraftSnapshot('company-a', form, [cropped], 3);
await store.save(initial);
form.title = 'Later unsaved edit';
const reopened = await new JobDraftStore(() => factory, 'qa-company-drafts').load('company-a');
assert.equal(reopened.form.title, 'QA café');
assert.equal(reopened.form.listingRequirements, 'Public requirement');
assert.equal(reopened.form.requirements, 'Internal criterion');
assert.equal(reopened.builderStep, 3);
assert.ok(reopened.savedAt);
assert.equal(reopened.images[0].name, cropped.name);
assert.equal(reopened.images[0].lastModified, 12345);
assert.equal(reopened.images[0].blob.type, 'image/png');
assert.deepEqual(new Uint8Array(await reopened.images[0].blob.arrayBuffer()), new Uint8Array(await cropped.arrayBuffer()), 'Save the cropped bytes, never a transient object URL');
assert.equal(await store.load('company-b'), null);

// Fail a write, then abort after its put request succeeded: neither is a save.
const put = IDBObjectStore.prototype.put;
try {
  IDBObjectStore.prototype.put = function () { throw new DOMException('QA quota', 'QuotaExceededError'); };
  await assert.rejects(store.save(jobDraftSnapshot('company-a', { ...EMPTY_JOB_FORM, title: 'Must not replace' }, [], 1)), /QA quota/);
} finally { IDBObjectStore.prototype.put = put; }
assert.equal((await store.load('company-a')).form.title, 'QA café');
try {
  IDBObjectStore.prototype.put = function (...args) { const request = put.apply(this, args); request.addEventListener('success', () => this.transaction.abort()); return request; };
  await assert.rejects(store.save(jobDraftSnapshot('company-a', { ...EMPTY_JOB_FORM, title: 'Aborted write' }, [], 1)));
} finally { IDBObjectStore.prototype.put = put; }
assert.equal((await store.load('company-a')).images.length, 1, 'Failed replacement preserves the complete previous snapshot');

await Promise.all([
  store.save(jobDraftSnapshot('company-a', { ...EMPTY_JOB_FORM, title: 'First' }, [], 1)),
  store.save(jobDraftSnapshot('company-a', { ...EMPTY_JOB_FORM, title: 'Latest' }, [], 2)),
]);
assert.equal((await store.load('company-a')).form.title, 'Latest');
assert.equal((await store.load('company-a')).images.length, 0, 'Removing/replacing an image removes its saved bytes');
await Promise.all([store.save(initial), store.remove('company-a')]);
assert.equal(await store.load('company-a'), null, 'An older queued save cannot resurrect a published draft');
await store.remove('company-a');

const legacyRaw = JSON.stringify({ form: { ...EMPTY_JOB_FORM, listingRequirements: null, requirements: 'Legacy public text', imagePending: true }, builderStep: 2 });
const legacy = readLegacyJobDraft('company-a', legacyRaw);
assert.equal(legacy.form.listingRequirements, 'Legacy public text');
assert.equal(legacy.savedAt, null, 'Do not invent a legacy save date');
assert.throws(() => jobDraftSnapshot('company-a', legacy.form, [], 2), /bilden saknas/);
assert.equal(readLegacyJobDraft('company-a', JSON.stringify({ form: EMPTY_JOB_FORM })), null);
assert.throws(() => readLegacyJobDraft('company-a', 'not-json'));
await assert.rejects(new JobDraftStore(() => undefined).load('company-a'), /lokal bildlagring/);
console.log('PASS IndexedDB emulator: atomic cropped bytes/text/step, reopen, owner separation, quota and transaction abort, replacement, ordered saves, deletion and legacy-image guards.');

// Execute the actual hook callbacks with a small effect scheduler. IndexedDB
// itself remains the emulator above; this is not a physical browser test.
const originalLoad = Module._load;
const previousWindow = globalThis.window;
const previousFile = globalThis.File;
globalThis.File = File;
globalThis.window = { localStorage: { getItem: () => null, removeItem() {} } };
const hookStore = new JobDraftStore(() => factory, 'qa-hook-drafts');
const cells = [];
let cursor = 0, effects = [], owner = 'company-a';
const same = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
const react = {
  useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }]; },
  useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
  useCallback(callback, deps) { const index = cursor++; if (!same(cells[index]?.deps, deps)) cells[index] = { deps, callback }; return cells[index].callback; },
  useEffect(callback, deps) { const index = cursor++; if (!same(cells[index]?.deps, deps)) { const prior = cells[index]; cells[index] = { deps }; effects.push(() => { prior?.cleanup?.(); cells[index].cleanup = callback(); }); } },
};
Module._load = function (name, parent, ...rest) {
  if (name === 'react') return react;
  if (name === '@/lib/job-copy') return require('../lib/job-copy.ts');
  if (name === '@/lib/job-drafts') return { ...require('../lib/job-drafts.ts'), jobDraftStore: hookStore };
  return originalLoad.call(this, name, parent, ...rest);
};
try {
  const { useJobDraft } = require('../hooks/use-job-draft.ts');
  let view;
  const render = () => { cursor = 0; effects = []; view = useJobDraft(owner); const run = effects; effects = []; run.forEach(effect => effect()); return view; };
  const settle = async () => { for (let i = 0; i < 12; i++) { await new Promise(resolve => setTimeout(resolve, 0)); render(); } };
  render(); await settle(); assert.equal(view.hydrated, true);
  view.setForm({ ...EMPTY_JOB_FORM, title: 'Hook cropped draft', imagePending: true }); view.setFiles([cropped]); view.setStep(3); render();
  await view.saveNow(); render();
  assert.equal(view.saveStatus, 'saved'); assert.equal((await hookStore.load(owner)).images.length, 1);
  // A successful autosave must not schedule an endless write loop.
  const savedAt = view.savedAt;
  await new Promise(resolve => setTimeout(resolve, 450)); render(); assert.equal(view.savedAt, savedAt);
  const oldSave = view.saveNow;
  owner = 'company-b'; render(); await settle(); assert.equal(view.hydrated, true); assert.equal(view.form.title, '');
  await assert.rejects(oldSave(), /Kontot har ändrats/);
  view.setForm({ ...EMPTY_JOB_FORM, title: 'B draft' }); render(); await view.saveNow(); render();
  const oldRead = hookStore.load.bind(hookStore);
  let finishOldRead;
  hookStore.load = id => id === 'company-a' ? new Promise(resolve => { finishOldRead = resolve; }) : oldRead(id);
  owner = 'company-a'; render(); assert.equal(view.hydrated, false);
  owner = 'company-b'; render(); assert.equal(view.hydrated, false, 'Returning accounts cannot reuse a previous hydration lease');
  await settle(); assert.equal(view.form.title, 'B draft');
  finishOldRead(initial); await settle(); assert.equal(view.form.title, 'B draft', 'A late account A read must not replace B');
  hookStore.load = oldRead;
  view.setForm(EMPTY_JOB_FORM); view.setFiles([]); render();
  await new Promise(resolve => setTimeout(resolve, 450)); await settle();
  assert.equal(await hookStore.load('company-b'), null, 'Clearing all fields cannot resurrect an old draft');
  owner = 'company-a'; render(); await settle();
  await view.clear(); render();
  assert.equal(await hookStore.load('company-a'), null);
  console.log('PASS actual draft hook: complete save, no autosave loop, account switch/stale callbacks, returning-account reload, late-read isolation, empty draft and post-publication cleanup.');
} finally {
  cells.forEach(cell => cell?.cleanup?.());
  Module._load = originalLoad;
  globalThis.window = previousWindow; globalThis.File = previousFile;
}
