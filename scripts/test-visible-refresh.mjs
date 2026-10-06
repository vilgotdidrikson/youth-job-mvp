import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'mnw-visible-refresh-'));
const originalWindow = globalThis.window, originalDocument = globalThis.document, originalNow = Date.now;
const flush = () => new Promise(resolve => setImmediate(resolve));
try {
  writeFileSync(join(dir, 'refresh.mjs'), ts.transpileModule(readFileSync('lib/visible-refresh.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const { subscribeVisibleRefresh } = await import(pathToFileURL(join(dir, 'refresh.mjs')));
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let now = 10000, calls = 0, finishFirst;
  Date.now = () => now;
  const unsubscribe = subscribeVisibleRefresh(async () => {
    calls++;
    if (calls === 1) await new Promise(resolve => { finishFirst = resolve; });
    if (calls === 2) throw new Error('Temporary read failure');
  });
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(calls, 1, 'Focus and visibility must share one in-flight read');
  now += 2000;
  window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls, 1, 'A slow read must not start parallel refreshes');
  finishFirst(); await flush();
  window.dispatchEvent(new Event('focus')); await flush();
  assert.equal(calls, 2);
  window.dispatchEvent(new Event('focus')); await flush();
  assert.equal(calls, 2, 'A failed read must not trigger an immediate retry loop');
  now += 2000;
  document.visibilityState = 'hidden';
  window.dispatchEvent(new Event('focus')); await flush();
  assert.equal(calls, 2, 'A hidden page must not refresh');
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(calls, 3, 'Returning later can recover from a failed read');
  unsubscribe(); now += 2000;
  window.dispatchEvent(new Event('focus')); await flush();
  assert.equal(calls, 3, 'Unmounted pages must release their event subscriptions');
  let queuedCalls = 0;
  const stopQueued = subscribeVisibleRefresh(async () => { queuedCalls++; });
  window.dispatchEvent(new Event('focus')); stopQueued(); await flush();
  assert.equal(queuedCalls, 0, 'An unmounted page must cancel a queued refresh');
  console.log('PASS: visible return refresh is deduplicated, bounded, recoverable and released on unmount; hidden pages do not poll.');
} finally {
  Date.now = originalNow;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  rmSync(dir, { recursive: true, force: true });
}
