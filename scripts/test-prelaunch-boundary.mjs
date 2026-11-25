import 'next/dist/server/node-environment-baseline.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';
import nextTesting from 'next/experimental/testing/server.js';
const { unstable_doesMiddlewareMatch: unstable_doesProxyMatch } = nextTesting;
import * as routes from '../lib/prelaunch-routes.ts';
import * as launch from '../lib/launch-mode.ts';
const localRequire = createRequire(import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const proxyModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => name === './lib/prelaunch-routes' ? routes : name === './lib/launch-mode' ? launch : localRequire(name), proxyModule, proxyModule.exports);
const { proxy, config } = proxyModule.exports;
delete process.env.MATCHNWORK_LAUNCH_MODE;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
const home = proxy(new NextRequest('https://matchnwork.se/?from=launch'));
assert.equal(home.headers.get('x-middleware-rewrite'), 'https://matchnwork.se/prelaunch?from=launch');
assert.equal(proxy(new NextRequest('https://www.matchnwork.se/login')).status, 307);
assert.equal(proxy(new NextRequest('https://matchnwork.se/prelaunch')).headers.get('x-middleware-next'), '1');
for (const path of ['/profile', '/company', '/signup', '/login', '/auth', '/chats', '/swipe', '/kartan', '/jobb/123', '/_next/data/build/profile.json']) {
  assert.equal(unstable_doesProxyMatch({ config, url: `https://matchnwork.se${path}` }), true, `matcher missed ${path}`);
  for (const headers of [{}, { rsc: '1', 'next-router-prefetch': '1' }, { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }]) {
    const response = proxy(new NextRequest(`https://matchnwork.se${path}?test=1`, { headers }));
    assert.equal(response.status, 307, path);
    assert.equal(response.headers.get('location'), 'https://matchnwork.se/');
  }
}
for (const path of ['/api/account', '/api/company/job/generate', '/api/voice/turn', '/api/prelaunch/not-allowed', '/api/demo', '/api/demo/chat/extra']) {
  assert.equal(unstable_doesProxyMatch({ config, url: `https://matchnwork.se${path}` }), true);
  const response = proxy(new NextRequest(`https://matchnwork.se${path}`, { method: 'POST' }));
  assert.equal(response.status,404);
  assert.equal(response.headers.get('cache-control'),'no-store');
}
for (const path of ['/demo', '/launch-privacy', '/avregistrera', '/launch-admin', '/api/prelaunch', '/api/prelaunch/admin', '/api/prelaunch/unsubscribe', '/api/demo/chat']) {
  const response = proxy(new NextRequest(`https://matchnwork.se${path}`));
  assert.equal(response.headers.get('x-middleware-next'), '1', path);
}
const preview = 'https://matchnwork-preview.vercel.app';
assert.equal(proxy(new NextRequest(`${preview}/login`)).headers.get('x-middleware-next'), '1');
process.env.NEXT_PUBLIC_SUPABASE_URL = launch.PRODUCTION_SUPABASE_URL;
assert.equal(proxy(new NextRequest(`${preview}/login`)).status, 307);
process.env.MATCHNWORK_LAUNCH_MODE = 'live';
for (const path of ['/', '/login', '/jobb', '/api/account', '/api/prelaunch/admin', '/avregistrera']) {
  assert.equal(proxy(new NextRequest(`https://matchnwork.se${path}`)).headers.get('x-middleware-next'), '1', path);
}
assert.equal(proxy(new NextRequest('https://matchnwork.se/prelaunch')).headers.get('location'), 'https://matchnwork.se/');
process.env.MATCHNWORK_LAUNCH_MODE = 'prelaunch';
assert.equal(proxy(new NextRequest(`${preview}/login`)).status, 307);
console.log('Next.js proxy passed launch mode, legacy pages, APIs and Next navigation checks.');
