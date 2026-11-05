// Real, fixed DevStaging acceptance. Never use production identities or keys.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co';
const app = 'https://youth-job-mvp-dev.vercel.app';
const key = process.env.MNW_CV_ANON_KEY;
assert.ok(key, 'MNW_CV_ANON_KEY required');
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claims.ref, 'vwcfjvwfeatvuisojwrh');
  assert.equal(claims.role, 'anon');
}
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const prefix = `qa-cv-sharing-${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = randomBytes(24).toString('base64url');
const checkpoint = '/tmp/mnw-cv-sharing-fixtures.json';
const accounts = [];
const jobs = [];
let current, browser, passed = 0, step = 'setup';
const check = (ok, label) => { assert.ok(ok, label); passed++; console.log(`PASS ${label}`); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bounded = (url, init = {}) => fetch(url, { ...init, signal: init.signal
  ? AbortSignal.any([init.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) });
const client = () => createClient(base, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: bounded },
});
// Product helpers use the real test account's SDK, not simulated Auth/HTTP/Storage.
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (m, f) => m._compile(ts.transpileModule(
  readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } },
).outputText, f);
Module._load = function (name, parent, ...rest) {
  if (name === '@/lib/supabase') return { getSupabaseClient: () => current };
  return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest);
};
const { Font } = require('@react-pdf/renderer');
const register = Font.register;
Font.register = def => register.call(Font, { ...def, fonts: def.fonts.map(f => ({ ...f,
  src: f.src.startsWith('/fonts/') ? path.join(process.cwd(), 'public', f.src) : f.src })) });
const { createCvPdfFile } = require('../lib/cv-pdf.tsx');
const { uploadYouthDocument } = require('../lib/storage.ts');
const { saveUploadedCvToProfile } = require('../lib/onboarding.ts');
const { emptyRecruitmentProfile } = require('../lib/recruitment-profile.ts');

async function rpc(account, name, args) {
  const result = await account.c.rpc(name, args);
  assert.ok(!result.error, `${name}: ${result.error?.code}`);
  return result.data;
}
async function cvRequest(account, jobId, youthId) {
  return bounded(`${app}/api/company/candidate-cv`, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
  }, body: JSON.stringify({ jobId, youthUserId: youthId }) });
}
async function exactSharedPdf(company, job, youth, expected) {
  const response = await cvRequest(company, job, youth);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const data = await response.json();
  assert.equal(data.kind, 'pdf');
  const signed = new URL(data.url);
  assert.equal(signed.origin, base);
  assert.ok(new Date(data.expiresAt).getTime() <= Date.now() + 301000);
  const file = await bounded(data.url);
  assert.equal(file.status, 200);
  assert.equal(hash(new Uint8Array(await file.arrayBuffer())), hash(expected));
}
async function deniedStorage(account, object, label) {
  const result = await account.c.storage.from('youth-documents').createSignedUrl(object, 60);
  check(!!result.error && [400, 403, 404].includes(Number(result.error.status)) && !result.data?.signedUrl, label);
}
async function browserProof(company, youth, firstJob, secondJob, expected, revision) {
  if (!process.env.MNW_CV_CHROMIUM) throw new Error('Browser required for sharing acceptance');
  const pw = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()] }));
  const rawProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const proxy = rawProxy ? new URL(rawProxy) : null;
  browser = await pw.chromium.launch({ headless: true, executablePath: process.env.MNW_CV_CHROMIUM,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(proxy ? { proxy: { server: proxy.origin, ...(proxy.username ? {
      username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } : {}) } } : {}) });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const ai = [];
  context.on('request', request => {
    if (/\/api\/(?:ai\/|cv\/generate|company\/candidate-assessment)/.test(new URL(request.url()).pathname)) ai.push(1);
  });
  await page.goto(`${app}/login`);
  await page.locator('input[name=email]').fill(company.email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Logga in', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/login');
  check(true, 'company logs in through deployed UI');
  const href = job => `${app}/company?view=kandidater&job=${job}&candidate=${youth.id}`;
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(href(firstJob));
    await page.getByRole('heading', { name: 'Ansökningsunderlag', exact: true }).waitFor();
    await page.getByText(`Delad version ${revision}`, { exact: false }).waitFor();
    check(!(await page.locator('body').innerText()).includes('PRIVATE_UNSELECTED'), `private optional data absent from company UI ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `company packet has no horizontal overflow ${width}`);
    const requested = context.waitForEvent('request', { predicate: r => r.method() === 'GET'
      && r.url().startsWith(`${base}/storage/v1/object/sign/youth-documents/`) });
    await page.getByRole('button', { name: 'Öppna delat original-CV', exact: true }).click();
    const request = await requested;
    const response = await bounded(request.url());
    check(response.ok && hash(new Uint8Array(await response.arrayBuffer())) === hash(expected), `deployed shared packet opens exact PDF ${width}`);
    for (const popup of context.pages().filter(p => p !== page)) await popup.close();
    await page.screenshot({ path: `/tmp/mnw-sharing-${width}.png`, fullPage: true });
    await page.goto(href(secondJob));
    await page.getByRole('heading', { name: 'Inga ansökningar ännu', exact: true }).waitFor();
    check(await page.getByRole('heading', { name: 'Ansökningsunderlag', exact: true }).count() === 0, `unrelated ad clears candidate packet ${width}`);
  }
  check(ai.length === 0, 'no browser AI assessment requests');
  await browser.close(); browser = undefined;
}

try {
  for (const role of ['youth', 'youth', 'company', 'company']) {
    step = `signup ${accounts.length}`;
    const c = client(), email = `${prefix}-${accounts.length}@example.invalid`;
    const result = await c.auth.signUp({ email, password, options: { data: { role } } });
    if (result.data.user?.id) accounts.push({ id: result.data.user.id, c, role, email,
      token: result.data.session?.access_token, deleted: false });
    check(!result.error && !!result.data.session, `real ${role} Auth session ${accounts.length}`);
    writeFileSync(checkpoint, JSON.stringify({ prefix, ids: accounts.map(a => a.id) }));
  }
  const [owner, other, company, foreignCompany] = accounts;
  current = owner.c;
  step = 'prepare youth profiles';
  for (const youth of [owner, other]) {
    const recruitment = emptyRecruitmentProfile();
    recruitment.preferences.motivation = 'PRIVATE_UNSELECTED';
    const result = await youth.c.from('youth_profiles').update({ full_name: 'QA Åsa Delning', city: 'QA Teststad',
      age: 18, short_onboarding_completed: true, recruitment_profile: recruitment }).eq('user_id', youth.id);
    check(!result.error, 'fictitious youth profile prepared');
  }
  const originals = [];
  const objects = [];
  for (const version of ['ORIGINAL A', 'PRIVATE NEW B']) {
    const file = await createCvPdfFile(`PROFIL\nQA Åsa Delning. ${version}. Jag kan inte arbeta måndagar.\n\nSPRÅK\nSvenska. SLUTMARKÖR ${version}`, 'QA Åsa Delning');
    originals.push(new Uint8Array(await file.arrayBuffer()));
    objects.push(await uploadYouthDocument(file));
  }
  await saveUploadedCvToProfile({ type: 'cv', name: 'QA-original-A.pdf', url: objects[0] });
  const name = `QA CV sharing ${prefix}`;
  const cp = await company.c.from('company_profiles').update({ company_name: name,
    administrator: 'QA Testkontakt', organization_number: '000000-0000' }).eq('user_id', company.id);
  check(!cp.error, 'fictitious pending company with unmistakable QA identity');
  for (let i = 0; i < 2; i++) {
    const job = randomUUID();
    const created = await company.c.from('jobs').insert({ id: job, company_user_id: company.id, company_name: name,
      title: `QA CV TEST ${i} – EJ RIKTIGT JOBB`, description: 'Fiktivt tekniskt åtkomstprov. Sök inte.', city: 'QA Teststad',
      status: 'active', is_active: true, publication_status: 'pending_verification' });
    assert.ok(!created.error, `job creation: ${created.error?.code}`); jobs.push(job);
    const draft = await company.c.from('job_match_profiles').upsert({ job_id: job, status: 'draft', role_summary: 'Fiktivt test, ingen modellbedömning' });
    check(!draft.error, 'draft rubric keeps background AI ineligible');
  }
  writeFileSync(checkpoint, JSON.stringify({ prefix, ids: accounts.map(a => a.id), company: company.id,
    reviewer: other.id, name, jobs, objects }));
  step = 'guarded QA verification'; console.log('PHASE waiting for guarded QA verification');
  const start = Date.now(); let seeded = false;
  while (Date.now() - start < 240000) {
    if (existsSync('/tmp/mnw-cv-sharing-seeded.json')) {
      const seed = JSON.parse(readFileSync('/tmp/mnw-cv-sharing-seeded.json', 'utf8'));
      if (seed.prefix === prefix && seed.verified === true) { seeded = true; break; }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(seeded, 'guarded verification not completed; acceptance blocked');
  const verified = await company.c.from('company_profiles').select('verification_status').eq('user_id', company.id).single();
  check(!verified.error && verified.data.verification_status === 'verified', 'fixture verified through normal guarded review');
  step = 'disclosure A';
  const previewA = await rpc(owner, 'get_my_application_disclosure_preview', { p_job_id: jobs[0], p_selection: [] });
  check(previewA.packet.cv.documents[0].url === objects[0] && !JSON.stringify(previewA.packet).includes('PRIVATE_UNSELECTED'), 'preview uses original A and excludes unselected optional facts');
  await rpc(owner, 'save_my_application_disclosure', { p_job_id: jobs[0], p_selection: [], p_source_token: previewA.source_token });
  const secondPreviewA = await rpc(owner, 'get_my_application_disclosure_preview', { p_job_id: jobs[1], p_selection: [] });
  await rpc(owner, 'save_my_application_disclosure', { p_job_id: jobs[1], p_selection: [], p_source_token: secondPreviewA.source_token });
  const sent = await rpc(owner, 'prepare_my_application', { p_job_id: jobs[0], p_notify: false });
  check(sent.status === 'submitted', 'real application submitted without AI');
  const matches = await company.c.from('matches').select('id').eq('job_id', jobs[0]);
  check(!matches.error && matches.data.length === 0, 'company read occurs before any match');
  await exactSharedPdf(company, jobs[0], owner.id, originals[0]); check(true, 'real company HTTP downloads exact shared A before match');
  const packetA = await rpc(company, 'get_application_disclosure', { p_job_id: jobs[0], p_youth_user_id: owner.id });
  assert.deepEqual(packetA.cv, previewA.packet.cv);
  check(!JSON.stringify(packetA).includes('PRIVATE_UNSELECTED'), 'company receives only previewed packet');
  for (const [actor, job, youth, status, label] of [
    [company, jobs[1], owner.id, 403, 'wrong job denied'],
    [foreignCompany, jobs[0], owner.id, 403, 'wrong company denied'],
    [other, jobs[0], owner.id, 403, 'other youth denied'],
    [company, jobs[0], other.id, 403, 'wrong youth denied'],
    [null, jobs[0], owner.id, 401, 'anonymous denied'],
  ]) check((await cvRequest(actor, job, youth)).status === status, label);
  step = 'profile replacement';
  await saveUploadedCvToProfile({ type: 'cv', name: 'QA-new-B.pdf', url: objects[1] });
  await exactSharedPdf(company, jobs[0], owner.id, originals[0]); check(true, 'profile replacement alone preserves shared A');
  await deniedStorage(company, objects[1], 'unshared new B cannot be signed by company');
  const staleStarted = Date.now();
  const stale = await owner.c.rpc('save_my_application_disclosure', { p_job_id: jobs[0], p_selection: [], p_source_token: previewA.source_token });
  check(stale.error?.code === 'PT409' && stale.status === 409 && Date.now() - staleStarted < 15000,
    'stale sharing approval returns bounded HTTP 409 without serialization retry loop');
  const stillA = await rpc(company, 'get_application_disclosure', { p_job_id: jobs[0], p_youth_user_id: owner.id });
  check(stillA.revision === packetA.revision && stillA.cv.documents[0].url === objects[0], 'failed stale save changes neither revision nor shared file');
  const submitStarted = Date.now();
  const staleSubmit = await owner.c.rpc('prepare_my_application', { p_job_id: jobs[1], p_notify: false });
  check(staleSubmit.error?.code === 'PT409' && staleSubmit.status === 409 && Date.now() - submitStarted < 15000,
    'legacy submission snapshot also returns bounded HTTP 409');
  const rolledBack = await owner.c.from('application_completions').select('job_id').eq('job_id', jobs[1]);
  assert.ok(!rolledBack.error, `rollback read: ${rolledBack.error?.code}`);
  check(!rolledBack.error && rolledBack.data.length === 0, 'stale submission rolls back the synthetic second application');
  const removed = await owner.c.storage.from('youth-documents').remove([objects[0]]);
  assert.ok(!removed.error);
  check((await cvRequest(company, jobs[0], owner.id)).status === 404, 'deleted shared A gives 404 without falling back to private B');
  step = 'explicit replacement';
  const previewB = await rpc(owner, 'get_my_application_disclosure_preview', { p_job_id: jobs[0], p_selection: [] });
  await rpc(owner, 'save_my_application_disclosure', { p_job_id: jobs[0], p_selection: [], p_source_token: previewB.source_token });
  const packetB = await rpc(company, 'get_application_disclosure', { p_job_id: jobs[0], p_youth_user_id: owner.id });
  check(packetB.cv.documents[0].url === objects[1] && packetB.revision > packetA.revision, 'explicit sharing updates file and revision');
  await exactSharedPdf(company, jobs[0], owner.id, originals[1]); check(true, 'company HTTP now returns exact explicitly shared B');
  step = 'deployed company UI';
  await browserProof(company, owner, jobs[0], jobs[1], originals[1], packetB.revision);
  step = 'withdrawal';
  const withdrawn = await rpc(owner, 'withdraw_my_application', { p_job_id: jobs[0], p_expected_submitted: true });
  check(withdrawn.status === 'withdrawn', 'real application withdrawal confirmed');
  check((await cvRequest(company, jobs[0], owner.id)).status === 403, 'withdrawal prevents fresh company HTTP authorization');
  await deniedStorage(company, objects[1], 'withdrawal prevents fresh Storage signing');
  console.log(`PASS ${passed} real sharing checks; no simulated Auth/Data/Storage/HTTP.`);
} catch (error) {
  console.error(JSON.stringify({ failedAt: step, errorType: error.name, message: error.message.slice(0, 200) }));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  // Company deletion first removes the synthetic ads; own API removes remaining files/profile.
  for (const account of [...accounts].reverse()) {
    if (account.token) try {
      const response = await bounded(`${app}/api/account`, { method: 'DELETE', headers: {
        Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ expectedUserId: account.id, password }) });
      account.deleted = response.status === 204;
    } catch { /* Remaining IDs must be recovered manually; never report clean success. */ }
  }
  console.log(JSON.stringify({ prefix, passed, remainingFixtureIds: accounts.filter(a => !a.deleted).map(a => a.id) }));
  if (accounts.some(a => !a.deleted)) process.exitCode = 1;
  Module._load = originalLoad;
}
