import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url), originalLoad = Module._load;
const originalTs = Module._extensions['.ts'], originalTsx = Module._extensions['.tsx'];
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (mod, file) => mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
const descriptors = Object.fromEntries(['window', 'document', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const revoke = URL.revokeObjectURL;
const React = require('react');
let current, timerId = 0;
const reads = [], downloads = [], views = [], revoked = [], timers = new Map();
const video = { id: 'qa-video-a', conversation_id: 'qa-chat', expires_at: new Date(Date.now() + 86400000).toISOString() };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const hooks = { ...React,
  useState(initial) { const v = current, i = v.index++; if (!(i in v.slots)) v.slots[i] = initial; return [v.slots[i], value => { v.updates++; v.slots[i] = typeof value === 'function' ? value(v.slots[i]) : value; }]; },
  useRef(initial) { const v = current, i = v.index++; return v.slots[i] ??= { current: initial }; },
  useCallback(fn, deps) { const v = current, i = v.index++, old = v.slots[i]; if (!old || !deps.every((d, n) => Object.is(d, old.deps[n]))) v.slots[i] = { fn, deps }; return v.slots[i].fn; },
  useEffect(fn, deps) { const v = current, i = v.index++, old = v.effects[i]; if (!old || !deps.every((d, n) => Object.is(d, old.deps[n]))) v.effects[i] = { fn, deps, pending: true, cleanup: old?.cleanup }; },
};
class View {
  constructor(id = video.id) { this.props = { videoId: id }; this.slots = []; this.effects = []; this.index = 0; this.updates = 0; views.push(this); }
  render() {
    const workspace = VideoPlayer(this.props);
    if (this.key !== workspace.key) { this.stop(); this.slots = []; this.effects = []; this.key = workspace.key; }
    // The hook harness intentionally selects the view whose component is rendering.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    current = this; this.index = 0; return workspace.type(workspace.props);
  }
  flush() { for (const e of this.effects.filter(Boolean)) if (e.pending) { e.cleanup?.(); e.cleanup = e.fn(); e.pending = false; } }
  stop() { for (const e of this.effects.filter(Boolean)) { e.cleanup?.(); e.cleanup = undefined; } }
}
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...(Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).flatMap(nodes)];
const text = root => root == null || typeof root === 'boolean' ? '' : typeof root !== 'object' ? String(root) : (Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).map(text).join('');
const button = v => { const b = nodes(v.render()).find(n => n.type === 'button'); assert.ok(b, 'Retry/play button remains available'); return b; };
let VideoPlayer;
try {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  URL.revokeObjectURL = src => revoked.push(src);
  Module._load = function(name, parent, ...rest) {
    if (name === 'react') return hooks;
    if (name === '@/lib/video-client') return {
      getVideo: (id, signal) => { const d = deferred(); reads.push({ id, signal, ...d }); return d.promise; },
      videoPlaybackUrl: (value, signal) => { const d = deferred(); downloads.push({ video: value, signal, ...d }); return d.promise; },
    };
    if (name.endsWith('.css')) return { default: {} };
    if (name === './ui-icon') return { UiIcon: () => null };
    return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest);
  };
  ({ VideoPlayer } = require('../components/video-player.tsx'));
  const ready = async () => { const v = new View(); v.render(); v.flush(); reads.at(-1).resolve(video); await settle(); v.render(); v.flush(); return v; };

  // Reproduction: the old player continues from stale metadata into byte retrieval.
  const stale = await ready(); button(stale).props.onClick(); const pending = reads.at(-1);
  const before = downloads.length; stale.stop(); const updates = stale.updates;
  pending.resolve(video); await settle();
  assert.equal(downloads.length, before, 'Unmounted player must not start playback after late metadata');
  assert.equal(stale.updates, updates);
  assert.equal(pending.signal.aborted, true);

  const initial = new View(); initial.render(); initial.flush(); const initialRead = reads.at(-1);
  const timeout = [...timers].find(([, t]) => t.ms <= 60000); assert.ok(timeout, 'Metadata read has a deadline');
  timers.delete(timeout[0]); timeout[1].fn(); await settle();
  assert.equal(initialRead.signal.aborted, true); assert.equal(button(initial).props.disabled, false);
  assert.match(text(initial.render()), /Försök igen/);
  button(initial).props.onClick(); const retry = reads.at(-1); retry.resolve(video); await settle();
  const retryDownload = downloads.at(-1); retryDownload.resolve('blob:retry'); await settle(); initial.render(); initial.flush();
  assert.ok(nodes(initial.render()).some(n => n.type === 'video' && n.props.src === 'blob:retry'));
  initialRead.resolve(null); await settle(); assert.ok(!text(initial.render()).includes('inte längre tillgänglig'));
  initial.stop(); assert.ok(revoked.includes('blob:retry'));

  const repeated = await ready(), click = button(repeated).props.onClick;
  const readCount = reads.length; click(); click();
  assert.equal(reads.length, readCount + 1, 'Same-frame double click starts one read');
  reads.at(-1).resolve(video); await settle(); const lateDownload = downloads.at(-1);
  repeated.props = { videoId: 'qa-video-b' }; repeated.render(); repeated.flush();
  assert.equal(lateDownload.signal.aborted, true);
  lateDownload.resolve('blob:stale'); await settle();
  assert.ok(revoked.includes('blob:stale'), 'Late object URL is released even if transport ignores abort');
  assert.ok(!nodes(repeated.render()).some(n => n.type === 'video' && n.props.src === 'blob:stale'));
  reads.at(-1).resolve({ ...video, id: 'qa-video-b' }); await settle(); repeated.render(); repeated.flush();
  button(repeated).props.onClick(); reads.at(-1).resolve(null); await settle();
  assert.match(text(repeated.render()), /inte längre tillgänglig/);
  repeated.stop();

  const stalled = await ready(); button(stalled).props.onClick(); reads.at(-1).resolve(video); await settle();
  const download = downloads.at(-1), deadline = [...timers].find(([, t]) => t.ms <= 60000); assert.ok(deadline);
  timers.delete(deadline[0]); deadline[1].fn(); await settle();
  assert.equal(download.signal.aborted, true); assert.equal(button(stalled).props.disabled, false);
  download.resolve('blob:timed-out'); await settle(); assert.ok(revoked.includes('blob:timed-out'));
  stalled.stop();
  console.log('PASS actual VideoPlayer callbacks/effects: stale metadata, abort, metadata/download deadline, retry, same-frame double click, video change, late URL release and unavailable video. Simulated hooks/transport; no browser or media claim.');
} finally {
  views.forEach(v => v.stop()); Module._load = originalLoad;
  for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  URL.revokeObjectURL = revoke;
  if (originalTs) Module._extensions['.ts'] = originalTs; else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx; else delete Module._extensions['.tsx'];
}
