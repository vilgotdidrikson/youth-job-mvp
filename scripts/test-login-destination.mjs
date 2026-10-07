import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'mnw-login-'));
try {
  writeFileSync(join(dir, 'destination.mjs'), ts.transpileModule(readFileSync('lib/login-destination.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { loginDestination } = await import(pathToFileURL(join(dir, 'destination.mjs')));
  assert.equal(loginDestination('company', '/swipe?saved=1'), '/company?view=swipe');
  assert.equal(loginDestination('company', '/applications'), '/company?view=swipe');
  assert.equal(loginDestination('youth', '/company?view=kandidater'), '/swipe');
  assert.equal(loginDestination('youth', '/admin'), '/swipe');
  assert.equal(loginDestination('private', '/youth/cv'), '/private');
  assert.equal(loginDestination('company', '/company?view=annonser'), '/company?view=annonser');
  assert.equal(loginDestination('youth', '/jobb/test?from=feed#details'), '/jobb/test?from=feed#details');
  assert.equal(loginDestination('youth', '/applications?job=test'), '/applications?job=test');
  assert.equal(loginDestination('company', '/chats?conversation=test'), '/chats?conversation=test');
  assert.equal(loginDestination('youth', '/admin/reports', true), '/admin/reports');
  for (const requested of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/%2f%2fevil.example', '/company/../admin', '/login', '/swipe\n']) {
    assert.equal(loginDestination('youth', requested), '/swipe');
  }
  console.log('PASS: role-specific login destinations, deep links, admin boundary and unsafe redirect rejection.');
} finally { rmSync(dir, { recursive: true, force: true }); }
