// Real browser IndexedDB and DevStaging Auth/Data/Storage. No AI or production fixtures.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createCanvas } from '@napi-rs/canvas';

const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co';
const app = process.env.MNW_DRAFT_APP || 'http://127.0.0.1:3020';
assert.ok(['http://127.0.0.1:3020', 'https://youth-job-mvp-dev.vercel.app'].includes(app), 'Dev-only application');
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.MNW_CV_ANON_KEY;
assert.ok(key);
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claims.ref, 'vwcfjvwfeatvuisojwrh'); assert.equal(claims.role, 'anon');
}
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()] }));
const prefix = `qa-job-drafts-${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = randomBytes(24).toString('base64url'), email = `${prefix}@example.invalid`;
const c = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) }),
} });
let id, token, browser, checks = 0, step = 'setup', aiRequests = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`PASS ${label}`); };
const hash = bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const rawProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY, proxy = rawProxy ? new URL(rawProxy) : null;
const record = page => page.evaluate(async ownerId => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('matchnwork-company-drafts', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try {
    const value = await new Promise((resolve, reject) => { const r = db.transaction('drafts', 'readonly').objectStore('drafts').get(ownerId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return value ? { ...value, images: await Promise.all((value.images || []).map(async image => ({ name: image.name, bytes: [...new Uint8Array(await image.blob.arrayBuffer())] }))) } : null;
  } finally { db.close(); }
}, id);
const rows = async () => { const r = await c.from('jobs').select('*').eq('company_user_id', id).order('created_at'); assert.ok(!r.error, `jobs read ${r.error?.code}`); return r.data; };
const saved = async page => { await page.getByRole('button', { name: 'Spara utkast', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Utkast sparat på den här enheten' }).waitFor(); };
const listingTab = page => page.getByRole('tab', { name: /Mina annonser/ }).click();
async function login(page) {
  await page.goto(`${app}/login`);
  await page.locator('input[name=email]').fill(email); await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Logga in', exact: true }).click();
  await page.waitForURL(u => u.pathname !== '/login');
}
try {
  const signed = await c.auth.signUp({ email, password, options: { data: { role: 'company' } } });
  id = signed.data.user?.id; token = signed.data.session?.access_token;
  check(!signed.error && !!id && !!token, 'real temporary company session');
  writeFileSync('/tmp/mnw-job-draft-fixtures.json', JSON.stringify({ prefix, ids: [id] }));
  const profile = await c.from('company_profiles').update({ company_name: `QA ${prefix}`, administrator: 'QA Testkontakt', organization_number: '000000-0000', city: 'Stockholm' }).eq('user_id', id);
  assert.ok(!profile.error, `company fixture ${profile.error?.code}`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.MNW_CV_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(proxy ? { proxy: { server: proxy.origin, bypass: '127.0.0.1,localhost', ...(proxy.username ? { username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } : {}) } } : {}) });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  context.on('request', request => { if (/\/api\/(?:ai\/|youth\/cv\/generate|company\/(?:job\/generate|candidate-assessment))/.test(new URL(request.url()).pathname)) aiRequests++; });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', error => console.log(`BROWSER_ERROR ${error.name}: ${error.message.slice(0, 180)}`));
  step = 'login and form'; await login(page);
  await page.goto(`${app}/company?view=skapa`);
  const title = `QA DRAFT ${prefix} – EJ RIKTIGT JOBB`;
  await page.getByLabel('Arbetstitel *', { exact: true }).fill(title);
  await page.locator('#job-builder-description').fill('Fiktiv teknisk QA-annons. Ingen verklig rekrytering.');
  await page.getByLabel('Krav i annonsen', { exact: false }).fill('Publikt: kan arbeta lördagar.');
  await page.getByRole('button', { name: 'Deltid', exact: true }).click();
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  await page.getByRole('button', { name: 'Svenska', exact: true }).click();
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    if (i) await page.getByRole('button', { name: 'Lägg till arbetsplats', exact: true }).click();
    const place = page.getByRole('region', { name: `Arbetsplats ${i + 1}`, exact: true });
    await place.getByLabel('Namn *', { exact: true }).fill(i ? 'QA Göteborg' : 'QA Stockholm');
    await place.getByLabel('Gatuadress *', { exact: true }).fill(i ? 'QA Testgatan 2' : 'QA Testgatan 1');
    await place.getByLabel('Postnummer *', { exact: true }).fill(i ? '41101' : '11122');
    await place.getByLabel('Ort *', { exact: true }).fill(i ? 'Göteborg' : 'Stockholm');
  }
  await page.getByLabel('Lön från', { exact: true }).fill('130');
  await page.getByLabel('Lön till', { exact: true }).fill('150');
  const canvas = createCanvas(1600, 1000), drawing = canvas.getContext('2d');
  drawing.fillStyle = '#f9c4d5'; drawing.fillRect(0, 0, 1600, 1000); drawing.fillStyle = '#402b38'; drawing.fillRect(100, 200, 400, 600); drawing.fillRect(1000, 0, 600, 400);
  step = 'actual crop and image persistence';
  await page.locator('input[type=file]').setInputFiles({ name: 'qa-geometric-fixture.png', mimeType: 'image/png', buffer: canvas.toBuffer('image/png') });
  await page.getByRole('dialog', { name: 'Beskär omslagsbilden' }).waitFor();
  await page.getByLabel('Zoom', { exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'Beskär och använd', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' }); await saved(page);
  const before = await record(page), cropHash = hash(before.images[0].bytes);
  check(before.images.length === 1 && before.images[0].bytes.length > 1000 && before.builderStep === 3, 'real cropped image/text/step saved atomically');
  check(before.form.workplaces.length === 2 && before.form.city === 'Stockholm', 'two workplaces and primary address saved');
  await page.reload(); await page.getByRole('heading', { name: 'Plats och praktiska detaljer', exact: true }).waitFor();
  const after = await record(page);
  check(hash(after.images[0].bytes) === cropHash && after.form.title === title && await page.locator('.job-builder-image-grid img').count() === 1, 'reload restores exact cropped bytes and preview');
  await listingTab(page); await page.getByRole('button', { name: 'Återuppta utkast', exact: true }).click();
  check(await page.getByRole('heading', { name: 'Plats och praktiska detaljer', exact: true }).isVisible(), 'listing overview resumes correct saved step');
  await page.getByRole('button', { name: 'Spara inför publicering', exact: true }).click();
  await page.waitForURL(u => u.searchParams.has('created'));
  const originals = await rows(); check(originals.length === 1 && originals[0].publication_status === 'pending_verification', 'one real ad saved and still hidden before verification');
  const original = originals[0];
  check(original.workplaces.length === 2 && original.salary_per_hour === '130–150 kr/tim', 'real database preserves both workplaces and exact salary');
  check(original.open_positions === 1, 'no user-supplied position count required; legacy database default retained');
  check((await record(page)).deleted === true && !(await record(page)).form, 'successful publication removes draft content and image bytes');
  const downloaded = await c.storage.from('job-images').download(original.image_url.split('/object/public/job-images/')[1]);
  assert.ok(!downloaded.error, `image read ${downloaded.error?.message}`);
  check(hash(new Uint8Array(await downloaded.data.arrayBuffer())) === cropHash, 'uploaded image is exactly the reviewed cropped file');

  step = 'copy active paused closed';
  for (const status of ['active', 'paused', 'closed']) {
    const updated = await c.from('jobs').update({ status }).eq('id', original.id); assert.ok(!updated.error);
    await page.goto(`${app}/company?view=annonser`);
    await page.getByRole('button', { name: 'Kopiera annons', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Kopiera annons', exact: true });
    if (status !== 'active') {
      const previous = await record(page);
      await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click();
      check((await record(page)).revision === previous.revision, `cancel copy preserves complete existing draft (${status})`);
      await page.getByRole('button', { name: 'Kopiera annons', exact: true }).click();
    }
    await dialog.getByRole('button', { name: status === 'active' ? 'Skapa annonskopia' : 'Ersätt utkast med kopia', exact: true }).click();
    await page.getByRole('heading', { name: 'Granska din annonskopia', exact: true }).waitFor();
    const copy = await record(page);
    check(copy.form.copiedFromTitle === title && !copy.form.copyReviewed && copy.builderStep === 1, `copy ${status} opens unreviewed new draft`);
    check(copy.form.workplaces.length === 2 && copy.form.workplaces.every(p => !original.workplaces.some(o => o.id === p.id)), `copy ${status} has independent workplace identities`);
    check(copy.form.listingRequirements === original.requirements && copy.form.requirements === 'Svenska' && copy.form.salaryText === original.salary_per_hour, `copy ${status} preserves separate public/internal requirements and salary`);
    check((await rows()).length === 1, `copy ${status} creates no recruitment or application`);
  }
  await page.getByLabel('Arbetstitel *', { exact: true }).fill(`${title} KOPIA`);
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  await page.getByRole('button', { name: 'Spara inför publicering', exact: true }).click();
  await page.getByText('Granska kopians datum, lön och villkor och bekräfta innan publicering.', { exact: true }).waitFor();
  check((await rows()).length === 1, 'unreviewed copy cannot be submitted');
  await page.getByRole('checkbox', { name: 'Jag har kontrollerat datum, lön och övriga villkor för den nya annonsen.' }).check();
  await page.getByRole('button', { name: 'Spara inför publicering', exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.waitForURL(u => u.searchParams.has('created'));
  const both = await rows();
  check(both.length === 2 && both.some(j => j.title === `${title} KOPIA`), 'same-frame double submit creates exactly one separate copy');
  const preserved = both.find(j => j.id === original.id);
  check(preserved.status === 'closed' && preserved.title === original.title && preserved.image_url === original.image_url && JSON.stringify(preserved.workplaces) === JSON.stringify(original.workplaces), 'publishing copy leaves original status/content/workplaces unchanged');

  step = 'two actual browser tabs';
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`${app}/company?view=skapa`);
    const a = `QA tab A ${width}`, b = `QA tab B ${width}`;
    await page.getByLabel('Arbetstitel *', { exact: true }).fill(a); await saved(page);
    const tab = await context.newPage(); tab.setDefaultTimeout(25000); await tab.goto(`${app}/company?view=skapa`);
    await tab.getByLabel('Arbetstitel *', { exact: true }).fill(b); await saved(tab);
    await page.getByLabel('Arbetstitel *', { exact: true }).fill(`QA unsaved A ${width}`);
    await page.getByRole('alert').filter({ hasText: 'Utkastet har ändrats i en annan flik' }).waitFor();
    check(await page.getByLabel('Arbetstitel *', { exact: true }).inputValue() === `QA unsaved A ${width}` && (await record(page)).form.title === b, `real tab conflict preserves local text and stored winner ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `conflict notice fits viewport ${width}`);
    await page.getByRole('button', { name: 'Öppna sparat utkast', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Öppna sparat utkast', exact: true });
    await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click();
    check(await page.getByLabel('Arbetstitel *', { exact: true }).inputValue() === `QA unsaved A ${width}`, `cancel reload keeps local edits ${width}`);
    await page.getByRole('button', { name: 'Öppna sparat utkast', exact: true }).click();
    await dialog.waitFor(); await page.screenshot({ path: `/tmp/mnw-job-draft-conflict-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Öppna sparat utkast', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    check(await page.getByLabel('Arbetstitel *', { exact: true }).inputValue() === b, `explicit reload reads latest real IndexedDB revision ${width}`);
    await page.getByLabel('Arbetstitel *', { exact: true }).fill(`QA fresh ${width}`); await saved(page);
    check((await record(page)).form.title === `QA fresh ${width}`, `reviewed fresh save succeeds ${width}`);
    await tab.close();
  }
  check(aiRequests === 0, 'no AI requests during the complete workflow');
  console.log(JSON.stringify({ prefix, checks, result: 'PASS', app, fixtureIds: [id], jobs: (await rows()).map(j => j.id) }));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', step, checks, error: error.message })); process.exitCode = 1;
} finally {
  await browser?.close();
  if (id && token) {
    const response = await fetch('https://youth-job-mvp-dev.vercel.app/api/account', { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password, expectedUserId: id }), signal: AbortSignal.timeout(45000) });
    if (!response.ok) { console.error(JSON.stringify({ cleanup: 'FAILED', status: response.status, remainingFixtureIds: [id] })); process.exitCode = 1; }
    else console.log(JSON.stringify({ cleanup: 'PASS', remainingFixtureIds: [] }));
  }
}
