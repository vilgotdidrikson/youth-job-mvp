import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import { checkAuthEmail } from './check-auth-email.mjs';
const origin = 'https://staging.example.invalid';
const config = { site_url: origin, uri_allow_list: `${origin}/login,${origin}/reset-password`, smtp_host: 'smtp.example.invalid', smtp_user: 'qa', smtp_port: 587, smtp_admin_email: 'qa@example.invalid', smtp_sender_name: 'MatchnWork', mailer_autoconfirm: false, mailer_secure_email_change_enabled: true, rate_limit_email_sent: 30, smtp_max_frequency: 60 };
for (const name of ['confirmation', 'recovery', 'email_change']) {
  const html = readFileSync(`supabase/templates/${name}.html`, 'utf8');
  assert.match(html, /lang="sv"/);
  assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.doesNotMatch(html, /<script|<img|\.Data|\.Email|\.TokenHash|\.RedirectTo|https?:\/\//);
  config[`mailer_templates_${name}_content`] = html;
  config[`mailer_subjects_${name}`] = 'MatchnWork QA';
}
assert.deepEqual(checkAuthEmail(config, origin), []);
for (const change of [{ site_url: 'https://production.example.invalid' }, { uri_allow_list: `${origin}/**` }, { smtp_host: '' }, { smtp_port: 25 }, { smtp_admin_email: 'bad' }, { mailer_autoconfirm: true }, { mailer_secure_email_change_enabled: false }, { rate_limit_email_sent: 2 }, { smtp_max_frequency: 1 }, { mailer_templates_recovery_content: '{{ .RedirectTo }}' }]) {
  assert.ok(checkAuthEmail({ ...config, ...change }, origin).length, JSON.stringify(change));
}
assert.throws(() => checkAuthEmail(config, `${origin}/other`));
const configToml = readFileSync('supabase/config.toml', 'utf8');
for (const name of ['confirmation', 'recovery', 'email_change']) assert.ok(configToml.includes(`content_path = "./supabase/templates/${name}.html"`));
// Execute the real auth functions, with the installed SDK serializing real requests
// against a fake HTTP transport. No messages or requests leave this test.
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const requests = [];
const sdk = createClient('https://qa.supabase.co', 'qa-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (url, options) => {
    requests.push({ url: new URL(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify(String(url).includes('/signup') ? { user: { id: 'qa', email: 'qa@example.invalid' }, session: null } : {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } },
});
const originalLoad = Module._load;
const originalWindow = globalThis.window;
try {
  Module._load = function (name, ...args) {
    if (name === '@/lib/supabase') return { getSupabaseClient: () => sdk };
    if (name === '@/lib/supabase-errors') return { getSupabaseErrorMessage: (_, fallback) => fallback, isNetworkError: () => false };
    return originalLoad.call(this, name, ...args);
  };
  const compiled = ts.transpileModule(readFileSync('lib/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = new Module(`${process.cwd()}/lib/auth-email-test.cjs`);
  compiledModule.filename = `${process.cwd()}/lib/auth-email-test.cjs`;
  compiledModule.paths = Module._nodeModulePaths(process.cwd());
  compiledModule._compile(compiled, compiledModule.filename);
  for (const currentOrigin of [origin, 'https://matchnwork.example.invalid', 'http://localhost:3000']) {
    globalThis.window = { location: { origin: currentOrigin } };
    await compiledModule.exports.signUp(' QA@EXAMPLE.INVALID ', 'qa-password', 'youth');
    await compiledModule.exports.requestPasswordReset(' QA@EXAMPLE.INVALID ');
    const [signup, recovery] = requests.slice(-2);
    assert.equal(signup.url.searchParams.get('redirect_to'), `${currentOrigin}/login`);
    assert.equal(recovery.url.searchParams.get('redirect_to'), `${currentOrigin}/reset-password`);
    assert.equal(signup.body.email, 'qa@example.invalid');
    assert.deepEqual(signup.body.data, { role: 'youth' });
    assert.equal(recovery.body.email, 'qa@example.invalid');
  }
} finally {
  Module._load = originalLoad;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
}
console.log('PASS auth SDK redirects in three environments, templates and deployment preflight negatives. Transport simulated; no delivery claim.');
