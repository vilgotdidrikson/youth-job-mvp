import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url), originalLoad = Module._load;
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = mod => { mod.exports = { __esModule: true, default: {} }; };
const React = require('react');
let current, client;
const reads = [], writes = [], views = [];
const editorWrites = [];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const timers = new Map(), realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
let timerId = 0;
globalThis.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
const hooks = {
  ...React,
  useState(initial) { const v = current, i = v.index++; if (!(i in v.slots)) v.slots[i] = typeof initial === 'function' ? initial() : initial; return [v.slots[i], value => { v.updates++; v.slots[i] = typeof value === 'function' ? value(v.slots[i]) : value; }]; },
  useRef(initial) { const v = current, i = v.index++; return v.slots[i] ??= { current: initial }; },
  useEffect(fn, deps) { const v = current, i = v.index++, old = v.effects[i]; if (!old || deps.some((d, n) => !Object.is(d, old.deps[n]))) v.effects[i] = { fn, deps, pending: true, cleanup: old?.cleanup }; },
};
class View {
  constructor(element) { this.element = element; this.slots = []; this.effects = []; this.index = 0; this.updates = 0; views.push(this); }
  render() { return renderView(this); }
  flush() { for (const e of this.effects.filter(Boolean)) if (e.pending) { e.cleanup?.(); e.cleanup = e.fn(); e.pending = false; } }
  stop() { for (const e of this.effects.filter(Boolean)) { e.cleanup?.(); e.cleanup = undefined; } }
}
function renderView(view) { current = view; view.index = 0; return view.element.type(view.element.props); }
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...(Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).flatMap(nodes)];
const text = root => root == null || typeof root === 'boolean' ? '' : typeof root !== 'object' ? String(root) : (Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).map(text).join('');
const button = (view, label) => { const found = nodes(view.render()).find(n => n.type === 'button' && text(n) === label); assert.ok(found, label); return found; };
client = {
  from(table) {
    const filters = {}, request = deferred(); let mode = 'read', payload, signal, started = false;
    const start = () => { if (!started) { started = true; (mode === 'read' ? reads : writes).push({ ...request, table, filters: { ...filters }, mode, payload, signal }); } return request.promise; };
    const query = {
      select() { return query; }, eq(k, v) { filters[k] = v; return query; },
      upsert(value) { mode = 'upsert'; payload = value; return query; }, delete() { mode = 'delete'; return query; },
      abortSignal(value) { signal = value; return query; }, maybeSingle: start, single: start,
      then(resolve, reject) { return start().then(resolve, reject); },
    };
    return query;
  },
};
Module._load = function (name, parent, ...rest) {
  if (name === 'react') return hooks;
  if (name === '@/lib/supabase') return { getSupabaseClient: () => client };
  if (name === '@/lib/jobs') return { updateJob: (...args) => { const operation = deferred(); editorWrites.push({ args, ...operation }); return operation.promise; } };
  return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest);
};
const a = { id: '11111111-1111-4111-8111-111111111111', name: 'QA City', address: 'QA Gatan 1', postal_code: '11122', city: 'Stockholm', longitude: 18, latitude: 59 };
const b = { ...a, id: '22222222-2222-4222-8222-222222222222', name: 'QA Väst', city: 'Göteborg' };
const props = { job: { id: 'qa-job-a', workplaces: [a, b] }, youthId: 'qa-youth-a' };
try {
  const { WorkplacePreference } = require('../components/workplace-preference.tsx');
  const wrapper = WorkplacePreference(props);
  assert.notEqual(wrapper.key, WorkplacePreference({ ...props, youthId: 'qa-youth-b' }).key, 'Same job cannot carry another youth preference across account changes');
  assert.notEqual(wrapper.key, WorkplacePreference({ ...props, job: { ...props.job, id: 'qa-job-b' } }).key);
  assert.notEqual(wrapper.key, WorkplacePreference({ ...props, readOnly: true }).key);
  const view = new View(wrapper); view.render(); view.flush();
  assert.deepEqual(reads[0].filters, { job_id: 'qa-job-a', youth_user_id: 'qa-youth-a' });
  assert.ok(reads[0].signal instanceof AbortSignal);
  reads[0].resolve({ data: { workplace_snapshot: a }, error: null }); await settle();
  assert.match(text(view.render()), /QA City/);
  let select = nodes(view.render()).find(n => n.type === 'select'); select.props.onChange({ target: { value: b.id } });
  const save = button(view, 'Spara arbetsplatsval').props.onClick;
  save(); save(); assert.equal(writes.length, 1, 'Two same-frame clicks start one write');
  assert.deepEqual(writes[0].payload, { job_id: props.job.id, youth_user_id: props.youthId, workplace_id: b.id });
  writes[0].reject(new Error('QA uncertain transport')); await settle();
  assert.match(text(view.render()), /Sparandet kunde inte bekräftas/);
  assert.equal(nodes(view.render()).find(n => n.type === 'select').props.value, b.id, 'Uncertain save keeps the selected value');
  button(view, 'Spara arbetsplatsval').props.onClick();
  writes[1].resolve({ data: { workplace_snapshot: b }, error: null }); await settle();
  assert.match(text(view.render()), /Arbetsplatsvalet är sparat/);
  select = nodes(view.render()).find(n => n.type === 'select'); select.props.onChange({ target: { value: '' } });
  button(view, 'Spara arbetsplatsval').props.onClick(); await settle();
  assert.equal(writes[2].mode, 'delete'); assert.deepEqual(writes[2].filters, { job_id: props.job.id, youth_user_id: props.youthId });
  writes[2].resolve({ data: null, error: null }); await settle();
  select = nodes(view.render()).find(n => n.type === 'select'); select.props.onChange({ target: { value: a.id } });
  button(view, 'Spara arbetsplatsval').props.onClick();
  view.stop(); const count = view.updates;
  writes[3].resolve({ data: { workplace_snapshot: a }, error: null }); await settle();
  assert.equal(view.updates, count, 'Detached preference cannot receive a late save or success notice');
  save(); assert.equal(writes.length, 4, 'Old detached save callback cannot start a new write');

  const waiting = new View(wrapper); waiting.render(); waiting.flush(); const late = reads.at(-1);
  const timeout = [...timers].find(([, t]) => t.ms === 15000); assert.ok(timeout); timers.delete(timeout[0]); timeout[1].fn(); await settle();
  assert.match(text(waiting.render()), /Kunde inte läsa arbetsplatsvalet/);
  late.resolve({ data: { workplace_snapshot: a }, error: null }); await settle();
  assert.match(text(waiting.render()), /Kunde inte läsa arbetsplatsvalet/, 'Late read after timeout cannot overwrite failure');
  button(waiting, 'Försök igen').props.onClick(); waiting.render(); waiting.flush();
  reads.at(-1).resolve({ data: { workplace_snapshot: b }, error: null }); await settle();
  assert.equal(nodes(waiting.render()).find(n => n.type === 'select').props.value, b.id); waiting.stop();
  const detached = new View(wrapper); detached.render(); detached.flush(); const oldRead = reads.at(-1); detached.stop(); const updates = detached.updates;
  oldRead.resolve({ data: { workplace_snapshot: a }, error: null }); await settle(); assert.equal(detached.updates, updates);
  const readonly = new View(WorkplacePreference({ ...props, readOnly: true })); readonly.render(); readonly.flush();
  reads.at(-1).resolve({ data: { workplace_snapshot: { ...a, name: 'QA äldre adress' } }, error: null }); await settle();
  assert.equal(nodes(readonly.render()).some(n => n.type === 'select' || n.type === 'button'), false);
  assert.match(text(readonly.render()), /adressen vid valet; arbetsplatsen har ändrats/); readonly.stop();
  const { JobWorkplaceEditor } = require('../components/job-workplace-editor.tsx');
  const { JobWorkplaceConflictError } = require('../lib/job-workplaces.ts');
  let savedCalls = 0, closeCalls = 0;
  const editor = new View({ type: JobWorkplaceEditor, props: { job: props.job, onSaved() { savedCalls++; }, onClose() { closeCalls++; } } });
  editor.render(); editor.flush();
  const fields = nodes(editor.render()).find(n => n.type?.name === 'JobWorkplaceFields');
  fields.props.onChange([{ ...a, name: 'QA changed locally' }, b]);
  const form = nodes(editor.render()).find(n => n.type === 'form');
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  assert.equal(editorWrites.length, 1);
  assert.deepEqual(editorWrites[0].args, [props.job.id, { workplaces: [{ ...a, name: 'QA changed locally' }, b] }, { expectedWorkplaces: [a, b] }]);
  editor.render().props.onClose(); assert.equal(closeCalls, 0, 'Synchronous modal close cannot bypass active save lock');
  editorWrites[0].reject(new JobWorkplaceConflictError()); await settle();
  assert.match(text(editor.render()), /Arbetsplatserna har ändrats/);
  assert.equal(nodes(editor.render()).find(n => n.type?.name === 'JobWorkplaceFields').props.value[0].name, 'QA changed locally');
  assert.equal(savedCalls, 0);
  nodes(editor.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  editor.stop(); const editorUpdates = editor.updates;
  editorWrites[1].resolve({ ...props.job, workplaces: [a, b] }); await settle();
  assert.equal(savedCalls, 0, 'Detached editor does not invoke callback for another view'); assert.equal(editor.updates, editorUpdates);
  console.log('PASS actual workplace preference callbacks: account/job/mode isolation, scoped reads/writes, same-frame double click, uncertain outcome, preserved selection, explicit removal, timeout/retry, historical/read-only view and late unmount responses. HTTP simulated.');
  console.log('PASS actual workplace editor: expected server baseline, synchronous double-click/close lock, preserved conflict edits and detached callback isolation. HTTP simulated.');
} finally {
  views.forEach(v => v.stop()); Module._load = originalLoad; globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear;
}
