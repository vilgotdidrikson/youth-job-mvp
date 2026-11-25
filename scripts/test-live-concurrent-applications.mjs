// Real DevStaging concurrency and deployed profile conflict recovery; no AI.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co', app = 'https://youth-job-mvp-dev.vercel.app';
const key = process.env.MNW_CV_ANON_KEY;
assert.ok(key);
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claims.ref, 'vwcfjvwfeatvuisojwrh'); assert.equal(claims.role, 'anon');
}
const uiOnly = process.env.MNW_CONCURRENT_UI_ONLY === '1';
const prefix = `qa-concurrent-${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = randomBytes(24).toString('base64url'), accounts = [], jobs = [];
let passed = 0, step = 'setup', browser;
const check = (ok, label) => { assert.ok(ok, label); passed++; console.log(`PASS ${label}`); };
const bounded = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
const client = () => createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: bounded } });
const readProfile = async account => {
  const r = await account.c.from('youth_profiles').select('recruitment_profile,recruitment_profile_version').eq('user_id', account.id).single();
  assert.ok(!r.error, `profile read: ${r.error?.code}`); return r.data;
};
const savePreferences = (account, profile, motivation) => account.c.rpc('save_my_recruitment_profile', {
  p_section: 'preferences', p_value: { ...profile.recruitment_profile.preferences, motivation },
  p_expected_version: profile.recruitment_profile_version,
});
const rpc = async (account, name, args) => {
  const r = await account.c.rpc(name, args); assert.ok(!r.error, `${name}: ${r.error?.code}`); return r.data;
};
const application = async (owner, job) => {
  const r = await owner.c.from('application_completions').select('status,withdrawn_at,submitted_at').eq('job_id', job).single();
  assert.ok(!r.error, `application read: ${r.error?.code}`); return r.data;
};
const withdraw = (owner, job, expected) => owner.c.rpc('withdraw_my_application', { p_job_id: job, p_expected_submitted: expected });
const prepare = (owner, job) => owner.c.rpc('prepare_my_application', { p_job_id: job, p_notify: false });

async function profileBrowser(owner) {
  assert.ok(process.env.MNW_CV_CHROMIUM, 'Chromium required');
  const require = createRequire(import.meta.url);
  const pw = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()] }));
  const rawProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY, proxy = rawProxy ? new URL(rawProxy) : null;
  browser = await pw.chromium.launch({ headless: true, executablePath: process.env.MNW_CV_CHROMIUM,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(proxy ? { proxy: { server: proxy.origin, ...(proxy.username ? { username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } : {}) } } : {}) });
  const context = await browser.newContext({ ignoreHTTPSErrors: true }), page = await context.newPage();
  page.setDefaultTimeout(30000);
  let ai = 0;
  context.on('request', r => { if (/\/api\/(?:ai\/|youth\/cv\/generate|company\/candidate-assessment)/.test(new URL(r.url()).pathname)) ai++; });
  await page.goto(`${app}/login`);
  await page.locator('input[name=email]').fill(owner.email); await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Logga in', exact: true }).click();
  await page.waitForURL(u => u.pathname !== '/login');
  check(true, 'real deployed youth login');
  for (const width of [375, 1280]) {
    step = `deployed stale editor ${width}`;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${app}/profile/develop?section=preferences`);
    const input = page.locator('#pb-motivation'); await input.waitFor();
    await input.fill(`QA osparad text ${width}`);
    const version = await readProfile(owner);
    const saved = await savePreferences(owner, version, `QA sparat från annan vy ${width}`);
    assert.ok(!saved.error);
    const response = page.waitForResponse(r => r.url() === `${base}/rest/v1/rpc/save_my_recruitment_profile` && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Spara den här delen', exact: true }).click();
    check((await response).status() === 409, `stale editor receives actual HTTP 409 ${width}`);
    await page.getByRole('alert').filter({ hasText: 'Profilen har ändrats i en annan vy' }).waitFor();
    check(await input.inputValue() === `QA osparad text ${width}`, `conflict preserves unsaved text ${width}`);
    check((await readProfile(owner)).recruitment_profile.preferences.motivation === `QA sparat från annan vy ${width}`, `stale UI does not overwrite winner ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `conflict UI fits ${width}`);
    await page.screenshot({ path: `/tmp/mnw-concurrent-ui-${width}.png`, fullPage: true });
    // User explicitly reloads after copying the local text; no silent merge/retry.
    await page.reload(); await page.locator('#pb-motivation').waitFor();
    check(await page.locator('#pb-motivation').inputValue() === `QA sparat från annan vy ${width}`, `explicit reload reads saved winner ${width}`);
    await page.locator('#pb-motivation').fill(`QA nytt godkänt försök ${width}`);
    const accepted = page.waitForResponse(r => r.url() === `${base}/rest/v1/rpc/save_my_recruitment_profile` && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Spara den här delen', exact: true }).click();
    check((await accepted).status() === 200, `fresh reviewed UI save succeeds ${width}`);
    check((await readProfile(owner)).recruitment_profile.preferences.motivation === `QA nytt godkänt försök ${width}`, `fresh retry persists exact text ${width}`);
  }
  check(ai === 0, 'no browser AI requests');
}

try {
  for (const role of uiOnly ? ['youth'] : ['youth', 'youth', 'company']) {
    step = `signup ${accounts.length}`;
    const c = client(), email = `${prefix}-${accounts.length}@example.invalid`;
    const r = await c.auth.signUp({ email, password, options: { data: { role } } });
    if (r.data.user?.id) accounts.push({ c, id: r.data.user.id, email, token: r.data.session?.access_token, deleted: false });
    check(!r.error && !!r.data.session, `real ${role} QA session`);
    writeFileSync('/tmp/mnw-concurrent-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id) }));
  }
  const [owner, other, company] = accounts;
  const basic = await owner.c.from('youth_profiles').update({ full_name: 'QA Samtidig Testsson', age: 18, city: 'QA Teststad',
    short_onboarding_completed: true, cv_text: 'Fiktivt QA-CV. Ingen verklig rekrytering.', cv_generated: true }).eq('user_id', owner.id);
  assert.ok(!basic.error, `basic profile: ${basic.error?.code}`);
  if (uiOnly) {
    await profileBrowser(owner);
  } else {
    step = 'parallel profile saves';
    const initial = await readProfile(owner), started = Date.now();
    const saves = await Promise.all([savePreferences(owner, initial, 'QA parallell A'), savePreferences(owner, initial, 'QA parallell B')]);
    const winners = saves.filter(r => !r.error), losers = saves.filter(r => r.error);
    check(winners.length === 1 && losers.length === 1 && losers[0].error.code === 'PT409' && losers[0].status === 409 && Date.now() - started < 15000,
      'same-version concurrent saves produce one winner and bounded HTTP 409');
    const final = await readProfile(owner);
    check(final.recruitment_profile_version === initial.recruitment_profile_version + 1 && final.recruitment_profile.preferences.motivation === winners[0].data.profile.preferences.motivation,
      'losing save cannot overwrite winner or advance profile version');
    const retry = await savePreferences(owner, final, 'QA omläst och godkänt');
    check(!retry.error && retry.data.version === final.recruitment_profile_version + 1, 'explicit fresh profile retry succeeds once');
    const forbidden = await company.c.rpc('save_my_recruitment_profile', { p_section: 'preferences', p_value: initial.recruitment_profile.preferences, p_expected_version: 0 });
    check(forbidden.error?.code === '42501', 'company cannot call youth profile save');
    const foreign = await other.c.from('youth_profiles').update({ full_name: 'QA forbidden overwrite' }).eq('user_id', owner.id).select('user_id');
    check(!foreign.error && foreign.data.length === 0, 'other youth cannot update owner row');

    step = 'prepare QA ads'; const name = `QA Concurrent ${prefix}`;
    const cp = await company.c.from('company_profiles').update({ company_name: name, administrator: 'QA Testkontakt', organization_number: '000000-0000' }).eq('user_id', company.id);
    assert.ok(!cp.error);
    for (let i = 0; i < 3; i++) {
      const job = randomUUID();
      const made = await company.c.from('jobs').insert({ id: job, company_user_id: company.id, company_name: name,
        title: `QA SAMTIDIGHET ${i} – EJ RIKTIGT JOBB`, description: 'Fiktivt tekniskt test. Sök inte.', city: 'QA Teststad', status: 'active', is_active: true, publication_status: 'pending_verification' });
      assert.ok(!made.error, `job: ${made.error?.code}`); jobs.push(job);
      const draft = await company.c.from('job_match_profiles').upsert({ job_id: job, status: 'draft', role_summary: 'QA utan AI' }); assert.ok(!draft.error);
    }
    writeFileSync('/tmp/mnw-concurrent-fixtures.json', JSON.stringify({ prefix, ids: accounts.map(a => a.id), company: company.id, reviewer: other.id, name, jobs }));
    console.log('PHASE waiting for guarded QA verification'); step = 'QA verification';
    const until = Date.now() + 240000; let seeded = false;
    while (Date.now() < until) {
      if (existsSync('/tmp/mnw-concurrent-seeded.json')) {
        const seed = JSON.parse(readFileSync('/tmp/mnw-concurrent-seeded.json', 'utf8'));
        if (seed.prefix === prefix && seed.verified === true) { seeded = true; break; }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(seeded, 'operator verification missing; not a passed test');
    step = 'stale withdrawal';
    check((await rpc(owner, 'prepare_my_application', { p_job_id: jobs[0], p_notify: false })).status === 'submitted', 'real baseline application submitted');
    const staleStart = Date.now(), stale = await withdraw(owner, jobs[0], false);
    check(stale.status === 409 && stale.error?.code === 'PT409' && Date.now() - staleStart < 15000, 'stale withdrawal confirmation returns bounded HTTP 409');
    check((await application(owner, jobs[0])).status === 'submitted', 'stale confirmation does not withdraw sent application');
    const rejected = await bounded(`${app}/api/youth/applications/submit`, { method: 'POST', headers: {
      Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ action: 'withdraw', jobId: jobs[0], expectedSubmitted: false }) });
    check(rejected.status === 409, 'deployed withdrawal route also returns HTTP conflict');
    step = 'duplicate withdrawals';
    const twice = await Promise.all([withdraw(owner, jobs[0], true), withdraw(owner, jobs[0], true)]);
    check(twice.every(r => !r.error && r.data.status === 'withdrawn') && twice[0].data.withdrawn_at === twice[1].data.withdrawn_at,
      'concurrent duplicate withdrawals are idempotent with one timestamp');
    const notifications = await company.c.from('notifications').select('id').eq('type', 'application_update').eq('href', `/company?view=kandidater&job=${jobs[0]}`);
    check(!notifications.error && notifications.data.length === 1, 'duplicate withdrawal emits only one company notification');
    const late = await prepare(owner, jobs[0]);
    check(!!late.error || late.data?.status === 'withdrawn', 'late submission does not revive withdrawn application');
    check((await application(owner, jobs[0])).status === 'withdrawn', 'withdrawal tombstone remains durable');
    const access = await company.c.rpc('get_application_disclosure', { p_job_id: jobs[0], p_youth_user_id: owner.id });
    check(access.error?.code === '42501', 'withdrawal denies fresh company packet access');
    for (let i = 1; i < 3; i++) {
      step = `real submit-withdraw race ${i}`;
      const draft = await owner.c.from('youth_application_drafts').insert({ job_id: jobs[i], youth_user_id: owner.id });
      assert.ok(!draft.error, `private draft: ${draft.error?.code}`);
      const start = Date.now();
      const operations = i === 1 ? [prepare(owner, jobs[i]), withdraw(owner, jobs[i], false)] : [withdraw(owner, jobs[i], false), prepare(owner, jobs[i])];
      const r = await Promise.all(operations), sent = r[i === 1 ? 0 : 1], withdrawn = r[i === 1 ? 1 : 0];
      const elapsed = Date.now() - start;
      const state = await application(owner, jobs[i]);
      console.log(JSON.stringify({ race: i, responseMs: elapsed, submitted: { code: sent.error?.code, status: sent.data?.status }, withdrawn: { code: withdrawn.error?.code, status: withdrawn.data?.status }, finalStatus: state.status }));
      check(elapsed < 15000 && (state.status === 'submitted'
        ? !sent.error && sent.data.status === 'submitted' && withdrawn.error?.code === 'PT409'
        : state.status === 'withdrawn' && !withdrawn.error && (!!sent.error || sent.data?.status === 'withdrawn')),
      `race ${i} has a legal serialized outcome (${state.status})`);
      if (state.status === 'submitted') await rpc(owner, 'withdraw_my_application', { p_job_id: jobs[i], p_expected_submitted: true });
      const interest = await owner.c.from('swipe_actions').select('decision').eq('job_id', jobs[i]);
      check(!interest.error && interest.data.every(row => row.decision !== 'interested'), `race ${i} leaves no interested swipe after confirmed withdrawal`);
    }
  }
  console.log(`PASS ${passed} real ${uiOnly ? 'deployed UI' : 'concurrency'} checks; no AI.`);
} catch (error) {
  console.error(JSON.stringify({ failedAt: step, errorType: error.name, message: error.message.slice(0, 200) })); process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const account of [...accounts].reverse()) {
    if (account.token) try {
      const r = await bounded(`${app}/api/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUserId: account.id, password }) });
      account.deleted = r.status === 204;
    } catch { /* Report exact QA IDs requiring cleanup. */ }
  }
  console.log(JSON.stringify({ prefix, passed, remainingFixtureIds: accounts.filter(a => !a.deleted).map(a => a.id) }));
  if (accounts.some(a => !a.deleted)) process.exitCode = 1;
}
