import 'next/dist/server/node-environment-baseline.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';
import nextTesting from 'next/experimental/testing/server.js';
const { unstable_doesMiddlewareMatch: unstable_doesProxyMatch } = nextTesting;
import * as routes from '../lib/prelaunch-routes.ts';
const localRequire = createRequire(import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => name === './lib/prelaunch-routes' ? routes : localRequire(name), module, module.exports);
const { proxy, config } = module.exports;
for (const path of ['/profile', '/company', '/signup', '/login', '/auth', '/chats', '/swipe', '/kartan', '/jobb/123', '/_next/data/build/profile.json']) {
  assert.equal(unstable_doesProxyMatch({ config, url: `https://matchnwork.se${path}` }), true, `matcher missed ${path}`);
  for (const headers of [{}, { rsc: '1', 'next-router-prefetch': '1' }, { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }]) {
    const response = proxy(new NextRequest(`https://matchnwork.se${path}?test=1`, { headers }));
    assert.equal(response.status, 307, path);
    assert.equal(response.headers.get('location'), 'https://matchnwork.se/');
  }
}
for (const path of ['/api/account', '/api/company/job/generate', '/api/voice/turn', '/api/prelaunch/not-allowed']) {
  assert.equal(unstable_doesProxyMatch({ config, url: `https://matchnwork.se${path}` }), true);
  const response = proxy(new NextRequest(`https://matchnwork.se${path}`, { method: 'POST' }));
  assert.equal(response.status,404);
  assert.equal(response.headers.get('cache-control'),'no-store');
}
for (const path of ['/', '/demo', '/launch-privacy', '/avregistrera', '/launch-admin', '/api/prelaunch', '/api/prelaunch/admin', '/api/prelaunch/unsubscribe']) {
  const response = proxy(new NextRequest(`https://matchnwork.se${path}`));
  assert.equal(response.headers.get('x-middleware-next'), '1', path);
}
console.log('Actual Next.js proxy and matcher checks passed for legacy pages, RSC/prefetch requests, APIs and allowed routes.');
