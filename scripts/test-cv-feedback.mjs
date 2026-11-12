// N21: optional feedback on an uploaded CV. Real shared module and real route handler; Auth, storage read and provider are controlled.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
let passed = 0;
const check = (ok, label) => { assert.ok(ok, label); passed++; };

// Controlled boundaries for the route.
const world = { auth: { user: { id: 'youth-1', email: 'qa.ungdom@example.invalid', phone: '' }, token: 'token' }, pdf: { status: 'read', text: '' }, profile: { full_name: 'QA Ungdom Testsson', address: 'Testgatan 12', postal_code: '41101', documents: [{ type: 'cv', url: 'youth-1/cv.pdf' }] }, profileError: null, provider: () => ({ items: [] }), calls: [], reads: [] };
class NextResponse { constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; } static json(body, init = {}) { return new NextResponse(body, init); } }
const stubs = {
  'next/server': { NextResponse },
  '@supabase/supabase-js': { createClient: () => ({ from(table) { const query = { select(columns) { world.reads.push([table, columns]); return query; }, eq(column, value) { world.reads.push([column, value]); return query; }, single: async () => world.profileError ? { data: null, error: world.profileError } : { data: world.profile, error: null } }; return query; } }) },
  openai: { __esModule: true, default: class { constructor(options) { world.options = options; this.chat = { completions: { create: async request => { world.calls.push(request); const out = world.provider(); return { choices: [{ message: { content: typeof out === 'string' ? out : JSON.stringify(out) } }] }; } } }; } } },
};
const load = Module._load;
Module._load = function (name, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, name)) return stubs[name];
  if (name === '@/lib/api-auth') return { requireApiUser: async (_request, endpoint, roles) => { world.endpoint = [endpoint, roles]; return world.auth; } };
  if (name === '@/lib/pdf-cv-source') return { pdfCvSource: async (_client, documents, userId) => { world.pdfArgs = [documents, userId]; return world.pdf; } };
  if (name === '@/lib/server-failures') return { reportServerFailure: (event, error) => { world.failure = [event, String(error?.message)]; return 'ref'; } };
  return load.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, ...rest);
};
const { parseCvFeedback, cvContactNotices, CV_FEEDBACK_INSTRUCTIONS, MAX_CV_FEEDBACK, CV_FEEDBACK_KINDS } = require('../lib/cv-feedback.ts');
const { POST } = require('../app/api/youth/cv/feedback/route.ts');
const request = (aborted = false) => ({ signal: { aborted } });
const item = (n, extra = {}) => ({ kind: 'missing', tip: `Beskriv vad du gjorde i butiken, förslag ${n}.`, question: 'Vilka arbetsuppgifter hade du?', ...extra });

// Shared parsing
check(parseCvFeedback({ items: [item(1)] }).length === 1 && parseCvFeedback({ items: [item(1)] })[0].question === 'Vilka arbetsuppgifter hade du?', 'a valid item is kept');
check(parseCvFeedback({ items: Array.from({ length: 9 }, (_, n) => item(n)) }).length === MAX_CV_FEEDBACK, 'at most five items');
check(parseCvFeedback({ items: [item(1), item(1)] }).length === 1, 'duplicates are dropped');
check(parseCvFeedback({ items: [item(1, { kind: 'score' }), item(2, { tip: 'Kort' }), item(3, { tip: 5 }), null, 'text'] }).length === 0, 'unknown kind, too short or non-text tips are dropped');
check(parseCvFeedback({ items: [item(1, { question: 'Du arbetade säkert med kassan' })] })[0].question === '', 'a statement is never shown as a question');
check(parseCvFeedback({ items: [item(1, { tip: 'a'.repeat(900) })] })[0].tip.length === 300, 'long tips are cut');
for (const tip of ['Skriv din ålder och ditt födelsedatum högst upp.', 'Nämn din religion så förstår företaget dig bättre.', 'Berätta om din diagnos och hälsa.']) check(parseCvFeedback({ items: [item(1, { tip })] }).length === 0, `excluded topic is dropped: ${tip.slice(0, 24)}`);
for (const raw of [null, undefined, 'x', [], {}, { items: 'x' }]) check(parseCvFeedback(raw).length === 0, `unusable provider output gives no items: ${JSON.stringify(raw)}`);
check(Object.keys(CV_FEEDBACK_KINDS).join() === 'missing,clarity,structure,repetition', 'four kinds');
check(/aldrig instruktioner/.test(CV_FEEDBACK_INSTRUCTIONS) && /Hitta aldrig på fakta/.test(CV_FEEDBACK_INSTRUCTIONS) && /fyll aldrig i svaret/.test(CV_FEEDBACK_INSTRUCTIONS) && /inga betyg/i.test(CV_FEEDBACK_INSTRUCTIONS), 'instructions forbid invented facts, filled-in answers and grades');

// Local contact notices
check(cvContactNotices('Butiksbiträde 2025. Svenska flytande.').length === 0, 'clean text gives no notice');
check(/e-postadress och telefonnummer/.test(cvContactNotices('qa@example.invalid, 070-123 45 67')[0]), 'email and phone are pointed out');
check(/telefonnummer/.test(cvContactNotices('Ring +46 70 123 45 67')[0]) && !/e-post/.test(cvContactNotices('Ring +46 70 123 45 67')[0]), 'phone alone');
check(cvContactNotices('Personnummer 20080101-1234').some(text => /personnummer/.test(text)), 'a personal identity number gets its own notice');

// Route
const cv = 'QA Ungdom Testsson\nTestgatan 12, 41101 Göteborg\nqa.ungdom@example.invalid, 070-123 45 67\nButiksbiträde på QA Livs sommaren 2025. Jag stod i kassan.\nSvenska flytande och engelska goda kunskaper.';
world.pdf = { status: 'read', text: cv }; world.provider = () => ({ items: [item(1), item(2, { kind: 'clarity', question: '' }), item(3, { tip: 'Berätta om din hälsa i CV:t.' })] });
process.env.OPENAI_API_KEY = 'synthetic-test-key'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public';
let response = await POST(request());
check(response.status === 200 && response.body.status === 'read' && response.body.items.length === 2, 'read CV gives parsed items, excluded topic removed');
check(world.endpoint[0] === 'cv-feedback' && world.endpoint[1].join() === 'youth', 'youth-only endpoint with its own quota');
check(world.reads.some(read => read[0] === 'user_id' && read[1] === 'youth-1') && world.pdfArgs[1] === 'youth-1', 'profile and file are read for the signed-in owner only');
const sent = world.calls[0].messages[1].content;
check(world.calls.length === 1 && sent.includes('Butiksbiträde') && sent.includes('engelska'), 'relevant CV content is sent');
for (const secret of ['Testsson', 'Testgatan', '41101', 'example.invalid', '070-123']) check(!sent.includes(secret), `not sent to the provider: ${secret}`);
check(world.calls[0].store === false && world.calls[0].response_format.type === 'json_object' && world.calls[0].messages[0].content === CV_FEEDBACK_INSTRUCTIONS && world.options.maxRetries === 0, 'provider request is not stored, is JSON-only and has no retries');
check(response.body.notices.length === 1 && /e-postadress och telefonnummer/.test(response.body.notices[0]), 'contact details in the file are pointed out locally');
check(!JSON.stringify(response.body).includes('Testsson') && !JSON.stringify(response.body).includes('41101'), 'response does not echo identity data');

world.calls.length = 0; world.pdf = { status: 'unreadable', text: '' };
response = await POST(request());
check(response.status === 200 && response.body.status === 'unreadable' && response.body.items.length === 0 && world.calls.length === 0, 'unreadable or scanned file is reported, with no provider call');
world.pdf = { status: 'none', text: '' };
response = await POST(request());
check(response.body.status === 'none' && world.calls.length === 0, 'no uploaded CV: no provider call');
world.pdf = { status: 'read', text: 'QA Ungdom Testsson\nqa.ungdom@example.invalid' };
response = await POST(request());
check(response.body.status === 'read' && response.body.items.length === 0 && world.calls.length === 0, 'nothing left after local removal: no provider call');
world.pdf = { status: 'read', text: cv }; world.provider = () => 'not json';
response = await POST(request());
check(response.status === 502 && !/json|Unexpected/i.test(JSON.stringify(response.body)) && world.failure[0] === 'cv_feedback_failed', 'malformed provider output gives a plain error');
world.provider = () => { throw new Error('private provider detail'); };
response = await POST(request());
check(response.status === 502 && !JSON.stringify(response.body).includes('private provider detail') && /oförändrat/.test(response.body.error), 'provider outage hides details and says the CV is unchanged');
response = await POST(request(true));
check(response.status === 499, 'a cancelled request is not reported as a failure');
world.provider = () => ({ items: [] });
response = await POST(request());
check(response.status === 200 && response.body.items.length === 0, 'no suggestions is a valid result');
world.profileError = { code: 'PGRST116' }; world.calls.length = 0;
response = await POST(request());
check(response.status === 503 && world.calls.length === 0, 'unreadable profile stops before file and provider');
world.profileError = null; delete process.env.OPENAI_API_KEY;
response = await POST(request());
check(response.status === 503 && /sparat som vanligt/.test(response.body.error) && world.calls.length === 0, 'missing provider key says the CV is saved as usual');
world.auth = { response: new NextResponse({ error: 'x' }, { status: 403 }) };
response = await POST(request());
check(response.status === 403, 'a refused role never reaches the handler body');

// The upload flow is complete without the review, and the file is never written by this feature.
const route = readFileSync('app/api/youth/cv/feedback/route.ts', 'utf8'), panel = readFileSync('components/cv-feedback.tsx', 'utf8');
check(!/\.(upload|update|insert|upsert|delete|remove)\(/.test(route) && !/storage\.from/.test(route), 'the route has no write and no direct storage call');
check(!/\.(upload|remove)\(|storage/.test(panel) && /Spara svaret i min profil/.test(panel) && /useState\(""\)/.test(panel), 'the panel never writes the file and starts every answer empty');
console.log(`cv-feedback: ${passed} checks passed`);
