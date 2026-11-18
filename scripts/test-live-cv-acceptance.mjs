// Run against DevStaging with MNW_CV_ANON_KEY and an installed Chromium.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { createElement } from 'react';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const app = 'https://youth-job-mvp-dev.vercel.app';
const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co';
const key = process.env.MNW_CV_ANON_KEY;
assert.ok(key?.startsWith('sb_publishable_'), 'Provide the DevStaging publishable key');
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
}));
const rawProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyUrl = rawProxy ? new URL(rawProxy) : null;
const proxy = proxyUrl ? {
  server: proxyUrl.origin,
  ...(proxyUrl.username ? { username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password) } : {}),
} : undefined;
const request = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
const client = createClient(base, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: request },
});
const prefix = 'qa-cv-acceptance-' + randomUUID().slice(0, 12);
const email = prefix + '@example.invalid';
const password = randomBytes(24).toString('base64url');
const name = 'QA Åsa Öberg';
const about = 'Jag är noggrann och trivs med att samarbeta.';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const browsers = [];
let userId, token, checks = 0, phase = 'prepare', aiRequests = 0;
function check(condition, description) {
  assert.ok(condition, description);
  checks++;
  console.log('PASS ' + description);
}
const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const go = (page, path) => page.goto(app + path, { waitUntil: 'domcontentloaded' });
const headingVisible = (page, name) => heading(page, name).waitFor();
async function begin(width) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.MNW_CV_HEADLESS_SHELL === '1') {
    args.push('--single-process', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader');
  }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MNW_CV_CHROMIUM, args, proxy });
  browsers.push(browser);
  const context = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true });
  await context.route(url => url.origin === app && /^\/api\/youth\/cv\/(generate|voice)/.test(url.pathname), route => {
    aiRequests++;
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(40000);
  await go(page, '/login');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await button(page, 'Logga in').click();
  await page.waitForURL(url => url.pathname !== '/login', { waitUntil: 'domcontentloaded' });
  check(true, 'real login at ' + width + ' px');
  return page;
}
async function profile() {
  const result = await client.from('youth_profiles').select('cv_text,cv_uploaded,cv_generated,documents').eq('user_id', userId).single();
  assert.ok(!result.error);
  return result.data;
}
async function openFromProfile(page, label) {
  await go(page, '/profile?tab=work');
  await button(page, /^Mitt CV/).click();
  const opened = page.context().waitForEvent('request', {
    predicate: request => request.method() === 'GET' && request.url().startsWith(base + '/storage/v1/object/sign/youth-documents/'),
  });
  await button(page, label).click();
  const response = await request((await opened).url());
  assert.ok(response.ok);
  return new Uint8Array(await response.arrayBuffer());
}
async function pdfText(bytes, label) {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { width, height } = page.getViewport({ scale: 1 });
      const items = (await page.getTextContent()).items.filter(item => item.str?.trim());
      assert.ok(items.length > 0, label + ' has a blank page');
      for (const item of items) {
        const [, , , , x, y] = item.transform;
        assert.ok(x >= 0 && y > 0 && x + item.width <= width + 1 && y + item.height <= height + 1, label + ' text outside page');
      }
      pages.push(items.map(item => item.str).join(' '));
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

try {
  const settings = await request(base + '/auth/v1/settings', { headers: { apikey: key } });
  assert.ok(settings.ok && (await settings.json()).mailer_autoconfirm, 'DevStaging must auto-confirm synthetic signup');
  const auth = await client.auth.signUp({ email, password, options: { data: { role: 'youth' } } });
  userId = auth.data.user?.id;
  token = auth.data.session?.access_token;
  check(!auth.error && userId && token, 'fictitious youth signs up in DevStaging');
  writeFileSync('/tmp/mnw-cv-acceptance-fixture.json', JSON.stringify({ prefix, userId }));
  const seed = await client.from('youth_profiles').update({
    full_name: name, age: 18, city: 'QA Teststad', short_onboarding_completed: true,
  }).eq('user_id', userId);
  assert.ok(!seed.error);

  phase = 'mobile upload and reopen';
  const mobile = await begin(375);
  const upload = await renderToBuffer(createElement(Document, {},
    createElement(Page, { size: 'A4', style: { padding: 45 } },
      createElement(Text, {}, 'QA PDF Åsa Öberg – fiktivt dokument'))));
  await go(mobile, '/youth/cv');
  await button(mobile, /Ladda upp ett CV/).click();
  await mobile.locator('input[type=file]').setInputFiles({ name: 'qa-cv.pdf', mimeType: 'application/pdf', buffer: upload });
  await headingVisible(mobile, 'Ditt CV är sparat');
  const uploaded = await profile();
  const uploadedDoc = uploaded.documents.find(doc => doc.type === 'cv');
  check(uploaded.cv_uploaded && !uploaded.cv_generated && uploadedDoc?.url.startsWith(userId + '/'), 'file picker persists owned upload');
  const reopened = await openFromProfile(mobile, 'Öppna mitt PDF-CV');
  check(hash(reopened) === hash(upload), 'uploaded PDF reopened in mobile context with exact bytes');
  const short = await pdfText(reopened, 'uploaded PDF');
  check(short.length === 1 && short[0].includes('Åsa Öberg'), 'one-page upload retains readable Swedish text');

  phase = 'mobile saves private draft';
  await go(mobile, '/youth/cv');
  await button(mobile, /^Skriv själv/).click();
  await mobile.getByLabel('Kort om mig').fill(about);
  await button(mobile, 'Fortsätt').click();
  await headingVisible(mobile, 'Utbildning');
  await mobile.getByLabel('Skola', { exact: true }).fill('Fiktiva gymnasiet');
  await button(mobile, 'Spara privat utkast på kontot').click();
  await mobile.getByText('Utkastet är sparat på kontot. Det kan öppnas på en annan enhet.', { exact: true }).waitFor();
  check((await profile()).cv_text === uploaded.cv_text, 'draft save leaves the finished CV intact');

  phase = 'independent desktop opens and updates draft';
  const desktop = await begin(1280);
  await go(desktop, '/youth/cv');
  await headingVisible(desktop, 'Skapa ditt CV');
  await button(desktop, 'Öppna sparat utkast').click();
  await headingVisible(desktop, 'Utbildning');
  check(await desktop.getByLabel('Skola', { exact: true }).inputValue() === 'Fiktiva gymnasiet', 'fresh desktop context restores exact step and school');
  await desktop.getByLabel('Program eller inriktning').fill('Teknik');
  await button(desktop, 'Fortsätt').click();
  await headingVisible(desktop, 'Erfarenhet');
  const experience = Array.from({ length: 36 }, (_, index) =>
    'Provstycke ' + (index + 1) + '. Jag hjälpte till på ett fiktivt evenemang och övade på att förbereda material, förklara uppgifter och samarbeta med andra.'
  ).join('\n');
  await desktop.getByLabel('Erfarenhet', { exact: true }).fill(experience);
  await button(desktop, 'Fortsätt').click();
  await desktop.getByLabel('Kompetenser', { exact: true }).fill('Samarbete, ansvar');
  await button(desktop, 'Fortsätt').click();
  await desktop.getByLabel('Språk', { exact: true }).fill('Svenska');
  await button(desktop, 'Fortsätt').click();
  await desktop.getByLabel('Meriter och certifikat').fill('QA SLUTMARKÖR – föreningsarbete');
  await button(desktop, 'Spara privat utkast på kontot').click();
  await desktop.getByText('Utkastet är sparat på kontot. Det kan öppnas på en annan enhet.', { exact: true }).waitFor();

  phase = 'mobile resumes desktop revision and completes CV without AI';
  await go(mobile, '/youth/cv');
  await button(mobile, 'Öppna sparat utkast').click();
  await headingVisible(mobile, 'Meriter & länkar');
  check((await mobile.getByLabel('Meriter och certifikat').inputValue()).includes('SLUTMARKÖR'), 'mobile restores newer desktop draft and active guide step');
  await button(mobile, 'Förhandsvisa mitt CV').click();
  await headingVisible(mobile, 'Granska ditt CV');
  check((await mobile.getByLabel('CV-förhandsvisning', { exact: true }).inputValue()).includes(about), 'manual preview restores original answer across both sessions');
  check(await button(mobile, 'Gör mitt CV klart').isDisabled(), 'manual save waits for fact approval');
  await mobile.getByRole('checkbox', { name: /Jag har granskat CV:t/ }).check();
  await button(mobile, 'Gör mitt CV klart').click();
  await headingVisible(mobile, 'Ditt CV är sparat');
  const finished = await profile();
  check(finished.cv_generated && finished.cv_text.includes(about) && finished.cv_text.includes('SLUTMARKÖR'), 'manual CV saved to actual profile');
  check(aiRequests === 0, 'manual creation and upload made no CV generation requests');

  phase = 'actual PDF export and reopen';
  await go(desktop, '/profile?tab=work');
  await button(desktop, /^Mitt CV/).click();
  const download = desktop.waitForEvent('download');
  await button(desktop, 'Spara CV som PDF').click();
  const result = await download;
  const output = '/tmp/' + prefix + '-generated.pdf';
  await result.saveAs(output);
  const bytes = await openFromProfile(desktop, 'Öppna CV som PDF');
  const { readFile } = await import('node:fs/promises');
  check(hash(bytes) === hash(await readFile(output)), 'generated PDF download matches reopened private file');
  const pages = await pdfText(bytes, 'generated PDF');
  const extracted = pages.join(' ');
  check(pages.length > 1 && pages[0].includes(name) && extracted.includes('SLUTMARKÖR'), 'multi-page generated PDF retains Swedish and the merits section');
  check((extracted.match(/Provstycke \d+\./g) || []).length === 36, 'all 36 experience paragraphs survive the page breaks');
  check(pages.some(page => /SPRÅK\s*- Svenska/.test(page)), 'language heading stays with its text');
  check(pages.every((page, index) => page.includes((index + 1) + ' / ' + pages.length)), 'each generated page has correct numbering');
  console.log(JSON.stringify({ result: 'PASS', checks, userId, pdfPages: pages.length, output }));
} catch (error) {
  const reason = String(error.message).replaceAll(password, '[redacted]');
  console.error(JSON.stringify({ result: 'FAIL', phase, checks, reason: (token ? reason.replaceAll(token, '[redacted]') : reason).slice(0, 550) }));
  process.exitCode = 1;
} finally {
  await Promise.allSettled(browsers.map(browser => browser.close()));
  if (userId) {
    let cleaned = false;
    if (token) {
      try {
        const result = await request(app + '/api/account', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedUserId: userId, password }),
        });
        cleaned = result.status === 204;
      } catch { /* Report only the synthetic ID if cleanup failed. */ }
    }
    console.log(JSON.stringify({ cleanup: cleaned ? 'PASS' : 'FAIL', remainingFixtureIds: cleaned ? [] : [userId] }));
    if (!cleaned) process.exitCode = 1;
  }
}
