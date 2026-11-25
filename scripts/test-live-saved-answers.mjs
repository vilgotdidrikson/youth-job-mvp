// Real DevStaging check of the F12/N19 saved-answers migration. One disposable fictional youth, no company, no AI.
// MNW_CV_ANON_KEY=<public DevStaging key> node scripts/test-live-saved-answers.mjs
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const base = 'https://vwcfjvwfeatvuisojwrh.supabase.co', app = 'https://youth-job-mvp-dev.vercel.app';
const key = process.env.MNW_CV_ANON_KEY;
assert.ok(key, 'MNW_CV_ANON_KEY required');
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claims.ref, 'vwcfjvwfeatvuisojwrh'); assert.equal(claims.role, 'anon');
}
const bounded = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
const client = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: bounded } });
const password = randomBytes(24).toString('base64url'), email = `qa-saved-answers-${Date.now()}-${randomUUID().slice(0, 8)}@example.invalid`;
let passed = 0, account = null, deleted = false, step = 'signup';
const check = (ok, label) => { assert.ok(ok, label); passed++; console.log(`PASS ${label}`); };
const read = async () => { const r = await client.from('youth_profiles').select('recruitment_profile,recruitment_profile_version').eq('user_id', account.id).single(); assert.ok(!r.error, `read: ${r.error?.code}`); return r.data; };
const save = (section, value, version) => client.rpc('save_my_recruitment_profile', { p_section: section, p_value: value, p_expected_version: version });
const answer = (n, extra = {}) => ({ text: `Fiktiv QA-uppgift ${n}: jag har truckkort.`, question: 'Vad vill du lägga till om ”Truckkort”?', savedAt: '2026-11-12', source: `qa-job:followup:${n}`, ...extra });
try {
  const signup = await client.auth.signUp({ email, password, options: { data: { role: 'youth' } } });
  if (signup.data.user?.id) account = { id: signup.data.user.id, token: signup.data.session?.access_token };
  check(!signup.error && !!signup.data.session, 'real disposable youth session');
  step = 'initial read';
  const start = await read();
  check(start.recruitment_profile.savedAnswers === undefined, 'new profile has no saved answers');
  step = 'save';
  const first = await save('savedAnswers', [answer(1)], start.recruitment_profile_version);
  check(!first.error && first.data.profile.savedAnswers.length === 1 && first.data.version === start.recruitment_profile_version + 1, 'saved answer is stored and the version increases');
  step = 'conflict';
  const stale = await save('savedAnswers', [answer(1), answer(2)], start.recruitment_profile_version);
  check(stale.error?.code === 'PT409', 'stale version gives PT409');
  step = 'validation';
  const invalid = [[answer(1, { text: '' })], [answer(1, { text: 'a'.repeat(601) })], [answer(1), answer(1)], [answer(1, { savedAt: '2026-02-30' })], Array.from({ length: 9 }, (_, n) => answer(n)), [answer(1, { extra: 'x' })]];
  for (const value of invalid) { const r = await save('savedAnswers', value, first.data.version); assert.equal(r.error?.code, '22023'); }
  check(true, 'six invalid shapes are refused with 22023');
  check((await save('privateNotes', [], first.data.version)).error?.code === '22023', 'unknown section is still refused');
  step = 'other section';
  const prefs = await save('preferences', { roles: ['Lager'], locations: [], travelMinutes: '', motivation: 'Fiktiv QA-motivation' }, first.data.version);
  check(!prefs.error && prefs.data.profile.savedAnswers.length === 1, 'saving another section keeps the saved answer');
  step = 'direct write';
  const direct = await client.from('youth_profiles').update({ recruitment_profile: { ...prefs.data.profile, savedAnswers: [{ text: 'x' }] } }).eq('user_id', account.id);
  check(!!direct.error, 'invalid direct write is refused by the database');
  step = 'remove';
  const removed = await save('savedAnswers', [], prefs.data.version);
  check(!removed.error && removed.data.profile.savedAnswers.length === 0 && (await read()).recruitment_profile.preferences.motivation === 'Fiktiv QA-motivation', 'answer can be removed and the rest of the profile is intact');
} catch (error) {
  console.error(JSON.stringify({ failedAt: step, message: String(error.message).slice(0, 200) })); process.exitCode = 1;
} finally {
  if (account?.token) try {
    const r = await bounded(`${app}/api/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUserId: account.id, password }) });
    deleted = r.status === 204;
  } catch { /* reported below */ }
  console.log(JSON.stringify({ passed, remainingFixtureIds: account && !deleted ? [account.id] : [] }));
  if (account && !deleted) process.exitCode = 1;
}
