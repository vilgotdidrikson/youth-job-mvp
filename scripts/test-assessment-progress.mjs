import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function compile(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, name => imports[name] ?? require(name));
  return module.exports;
}
const progress = compile('lib/assessment-progress.ts');
const { observeAssessment, assessmentDeadline } = progress;
const settle = () => new Promise(resolve => setImmediate(resolve));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = { criteria: [], score: null, confidence: 'low', coverage: 0, explanation: 'Fiktivt testunderlag' };
let states, failures, reads, enqueues;
function watch(read, overrides = {}) {
  states = []; failures = []; reads = 0; enqueues = 0;
  return observeAssessment({ read: async signal => { reads++; return read(signal); }, enqueue: async () => { enqueues++; }, update: value => states.push(value), fail: value => failures.push(value), visible: () => true, pollMs: 5, waitMs: 500, requestMs: 100, ...overrides });
}
let observer = watch(() => ({ status: 'completed', assessment: result, updated_at: '2026-10-15T14:00:00Z' }));
await settle(); assert.equal(states[0].assessment, result); assert.equal(enqueues, 0); observer.stop();
observer = watch(() => reads === 1 ? { status: 'unrequested' } : { status: 'completed', assessment: result });
await sleep(20); assert.equal(enqueues, 1); assert.equal(states.at(-1).assessment, result); observer.stop();
observer = watch(() => ({ status: 'pending' }), { waitMs: 20 });
await sleep(35); assert.match(failures[0], /längre tid/); const stoppedReads = reads; await sleep(15); assert.equal(reads, stoppedReads); observer.stop();
observer = watch(() => { throw new Error('offline'); });
await settle(); assert.match(failures[0], /anslutningen/); observer.stop();
observer = watch(() => ({ status: 'failed', retrying: false }));
await settle(); assert.match(failures[0], /Försök igen/); observer.stop();
observer = watch(() => ({ status: 'unrequested' }), { enqueue: async () => { throw new Error('denied'); } });
await settle(); assert.equal(failures.length, 1); observer.stop();
let resolveRead;
observer = watch(() => new Promise(resolve => { resolveRead = resolve; }));
observer.stop(); resolveRead({ status: 'completed', assessment: result }); await settle(); assert.equal(states.length, 0);
observer = watch(() => new Promise(() => {}), { requestMs: 10 });
await sleep(25); assert.equal(failures.length, 1, 'Hung RPC must release polling and show recovery'); observer.stop();
const aborted = new AbortController(); aborted.abort();
await assert.rejects(assessmentDeadline(new Promise(() => {}), aborted.signal), /lång tid/);

// Execute actual component handlers with deterministic hook/transport boundaries.
const slots = [], effects = []; let index = 0, pendingResponse, followupFails = false;
const react = { useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; }, useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; }, useEffect(fn) { index++; if (!effects.length) effects.push(fn); } };
const component = compile('components/candidate-assessment-panel.tsx', {
  react,
  '@/lib/api-client': { authenticatedHeaders: async () => ({}) },
  '@/lib/assessment-progress': progress,
  '@/lib/supabase': { getSupabaseClient: () => ({ rpc: () => ({ abortSignal: async () => ({ data: { status: 'pending' } }) }) }) },
  '@/lib/application-completions': { getApplicationFollowups: async () => { if (followupFails) throw new Error('followups unavailable'); return []; } },
  '@/lib/visible-refresh': { subscribeVisibleRefresh: () => () => {} },
});
const props = { jobId: 'qa-job', youthUserId: 'qa-youth' };
const wrapper = component.CandidateAssessmentPanel(props);
assert.notEqual(wrapper.key, component.CandidateAssessmentPanel({ ...props, youthUserId: 'qa-other' }).key, 'Candidate changes reset all state');
const render = () => { index = 0; return wrapper.type(props); };
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...(Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).flatMap(child => child === root ? [] : nodes(child))];
const button = () => nodes(render()).find(node => node.type === 'button');
globalThis.document = { visibilityState: 'visible' };
globalThis.fetch = async () => pendingResponse;
render(); const cleanup = effects[0](); await settle();
assert.equal(button().props.disabled, false, 'Pending background jobs must not disable manual recovery');
pendingResponse = new Response(JSON.stringify({ assessment: result, createdAt: '2026-10-15T14:00:00Z', cached: true }), { status: 200 });
followupFails = true;
await button().props.onClick(); await settle();
assert.ok(nodes(render()).some(node => node.type === 'time' && node.props.dateTime === '2026-10-15T14:00:00Z'));
assert.equal(nodes(render()).filter(node => node.props?.role === 'alert').length, 0, 'Follow-up failure may not hide a completed assessment');
pendingResponse = new Response(JSON.stringify({ error: 'Tillfälligt fel' }), { status: 503 });
await button().props.onClick(); await settle();
assert.equal(button().props.children, 'Försök igen');
assert.ok(nodes(render()).some(node => node.props?.className === 'candidate-assessment-summary'), 'Previous assessment survives update errors');
assert.ok(nodes(render()).some(node => node.props?.role === 'alert'));
pendingResponse = new Response(JSON.stringify({ assessment: result }), { status: 200 });
await button().props.onClick(); await settle();
assert.equal(nodes(render()).filter(node => node.props?.role === 'alert').length, 0);
cleanup();
console.log('PASS: completed, queue, bounded wait, offline, terminal failure, enqueue failure, cancellation, hung RPC, actual manual recovery, cache date, follow-up isolation, preserved results and successful retry.');
