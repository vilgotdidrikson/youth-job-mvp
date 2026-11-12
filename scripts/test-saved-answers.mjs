// F12/N19: saved supplement answers. Runs the real shared modules; only the Supabase transport is controlled.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
const load = Module._load;
Module._load = function (name, ...rest) { return load.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, ...rest); };
const { emptyRecruitmentProfile, validateRecruitmentProfile, readRecruitmentProfile, recruitmentProfileSource, completedProfileSections, PROFILE_SECTIONS, MAX_SAVED_ANSWERS } = require('../lib/recruitment-profile.ts');
const { canSaveAnswer, savedAnswerSource, savedAnswerEntry, withSavedAnswer, changeSavedAnswers, loadSavedAnswers, SavedAnswerError, SAVE_ANSWER_PROMPT } = require('../lib/saved-answers.ts');
const { disclosedRecruitmentProfile, disclosedMatchingSource } = require('../lib/application-disclosure.ts');
const { candidateSource, matchingCriteria, assessDisclosedCandidate } = require('../lib/candidate-assessment.ts');
let passed = 0;
const check = (ok, label) => { assert.ok(ok, label); passed++; };
const throws = run => { try { run(); } catch { return true; } return false; };
const entry = (n, text = `Jag har truckkort A${n}`) => ({ text, question: 'Vad vill du lägga till om ”Truckkort”?', savedAt: '2026-11-12', source: savedAnswerSource('job-a', `followup:${n}`) });

// Profile model
const profile = { ...emptyRecruitmentProfile(), savedAnswers: [entry(1)] };
check(validateRecruitmentProfile(profile).savedAnswers.length === 1, 'validation keeps saved answers');
check(validateRecruitmentProfile(emptyRecruitmentProfile()).savedAnswers === undefined, 'profiles without saved answers keep the original four-key shape');
check(JSON.stringify(Object.keys(validateRecruitmentProfile(emptyRecruitmentProfile())).sort()) === JSON.stringify(['availability', 'examples', 'preferences', 'qualifications']), 'no fifth key is written for older profiles');
for (const [label, value] of [['nine answers', Array.from({ length: MAX_SAVED_ANSWERS + 1 }, (_, n) => entry(n))], ['empty text', [entry(1, ' ')]], ['long text', [entry(1, 'a'.repeat(601))]], ['bad date', [{ ...entry(1), savedAt: '2026-13-40' }]], ['duplicate', [entry(1), entry(1)]], ['object', {}]])
  check(throws(() => validateRecruitmentProfile({ ...emptyRecruitmentProfile(), savedAnswers: value })), `rejected: ${label}`);
check(readRecruitmentProfile({ ...emptyRecruitmentProfile(), savedAnswers: [entry(1, '')] }).savedAnswers === undefined, 'an invalid stored profile is never read as partially valid');
check(PROFILE_SECTIONS.length === 4 && completedProfileSections(profile).length === 0, 'saved answers are not a profile step and do not count as progress');
const source = recruitmentProfileSource({ ...emptyRecruitmentProfile(), savedAnswers: [entry(1, 'Jag har truckkort A1\noch kör varje vecka')] });
check(source === 'Sparad egen uppgift från tidigare komplettering: Jag har truckkort A1 och kör varje vecka', 'matching source has one self-reported line with only the saved text');
check(!source.includes('Vad vill du') && !source.includes('job-a'), 'the original question and source never reach the matching text');

// Choice rules
check(SAVE_ANSWER_PROMPT === 'Vill du spara det här svaret i din profil så att det kan återanvändas i framtida ansökningar?', 'decided prompt text');
check(canSaveAnswer('Vad vill du lägga till om ”Truckkort”?', 'Truckkort') && canSaveAnswer('Hur beskriver du dina kunskaper i engelska?', 'Engelska'), 'general facts can be saved');
for (const label of ['Kan arbeta helger', 'Kan börja omgående', 'Kvällar och skift', 'Tillgänglig dagtid']) check(!canSaveAnswer('Vilka dagar och tider kan du arbeta?', label), `time-bound answer is not offered: ${label}`);
check(!canSaveAnswer('Vilket är ditt tidigaste startdatum?'), 'start date is not offered');
const made = savedAnswerEntry('  Jag har truckkort  ', 'q'.repeat(400), 'job-a:followup:1', new Date('2026-11-12T10:00:00Z'));
check(made.text === 'Jag har truckkort' && made.question.length === 300 && made.savedAt === '2026-11-12', 'entry is trimmed, dated and keeps a bounded question');
check(withSavedAnswer([entry(1)], entry(1, 'Rättad uppgift')).length === 1 && withSavedAnswer([entry(1)], entry(1, 'Rättad uppgift'))[0].text === 'Rättad uppgift', 'saving the same answer again replaces it');
check(throws(() => withSavedAnswer(Array.from({ length: MAX_SAVED_ANSWERS }, (_, n) => entry(n)), entry(99))), 'the ninth answer is refused before any write');

// Sharing: private until selected, and only the text
const packet = { version: 1, revision: 1, job_id: 'job-b', youth_user_id: 'youth', job_title: 'QA lager', company_name: 'QA B', identity: { full_name: 'QA Ungdom', age: 17 }, cv: { text: 'Fiktivt CV.', structured: {}, documents: [] }, practical: { city: 'QA', availability: emptyRecruitmentProfile().availability }, profile_items: [] };
const internal = candidateSource({ cv_text: 'Fiktivt CV.', recruitment_profile: profile });
check(internal.includes('Sparad egen uppgift från tidigare komplettering: Jag har truckkort A1'), 'internal matching input for a later application contains the saved answer');
const criteria = matchingCriteria([{ label: 'Truckkort', required: true }]), raw = [{ id: 'c0', status: 'fulfilled', evidence: 'Jag har truckkort A1' }];
check(assessDisclosedCandidate(criteria, raw, internal, disclosedMatchingSource(packet).text).criteria[0].status === 'unknown', 'an unshared saved answer gives the company no quote or score');
const shared = { ...packet, profile_items: [{ key: 'answer:0', label: 'Sparad egen uppgift – självuppgiven', text: 'Jag har truckkort A1', value: 'Jag har truckkort A1' }] };
check(disclosedRecruitmentProfile(shared).savedAnswers[0].text === 'Jag har truckkort A1', 'a selected answer is reconstructed from the shared packet');
check(assessDisclosedCandidate(criteria, raw, internal, disclosedMatchingSource(shared).text).criteria[0].status === 'fulfilled', 'a selected answer can support the criterion for the company');
check(disclosedRecruitmentProfile({ ...packet, profile_items: [{ key: 'answer:0', label: 'x', text: '[Text med bostadsadress utelämnad.]', value: null }] }).savedAnswers === undefined, 'a withheld item adds nothing');

// Versioned owner write with a controlled client
const client = ({ user = 'youth', stored = { savedAnswers: [entry(1)] }, version = 4, rpcError = null, readError = null } = {}) => {
  const calls = [];
  const query = { select() { return query; }, eq(column, value) { calls.push(['eq', column, value]); return query; }, abortSignal() { return query; }, single: async () => readError ? { data: null, error: readError } : { data: { recruitment_profile: { ...emptyRecruitmentProfile(), ...stored }, recruitment_profile_version: version }, error: null } };
  return { calls, auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) }, from(table) { calls.push(['from', table]); return query; },
    rpc(name, args) { calls.push(['rpc', name, args]); return { abortSignal: async () => rpcError ? { data: null, error: rpcError } : { data: { profile: { ...emptyRecruitmentProfile(), savedAnswers: args.p_value }, version: version + 1 }, error: null } }; } };
};
const signal = new AbortController().signal;
let c = client();
const result = await changeSavedAnswers(c, 'youth', current => withSavedAnswer(current, entry(2)), signal);
const rpc = c.calls.find(call => call[0] === 'rpc');
check(result.length === 2 && rpc[1] === 'save_my_recruitment_profile' && rpc[2].p_section === 'savedAnswers' && rpc[2].p_expected_version === 4 && rpc[2].p_value.length === 2, 'write appends to the list just read and sends that exact version');
check(c.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'youth'), 'read is filtered on the owner');
c = client({ user: 'someone-else' });
check(await changeSavedAnswers(c, 'youth', list => list, signal).then(() => false, error => error instanceof SavedAnswerError) && !c.calls.some(call => call[0] === 'rpc' || call[0] === 'from'), 'a changed account stops before any read or write');
c = client({ rpcError: { code: 'PT409' } });
check(await changeSavedAnswers(c, 'youth', list => list, signal).then(() => false, error => /ändrades samtidigt/.test(error.message)), 'a concurrent profile change is reported, not overwritten');
c = client({ rpcError: { code: '22023' } });
check(await changeSavedAnswers(c, 'youth', list => list, signal).then(() => false, error => error instanceof SavedAnswerError && /kunde inte sparas/.test(error.message)), 'a server refusal gives a plain retry message');
c = client({ stored: { savedAnswers: Array.from({ length: MAX_SAVED_ANSWERS }, (_, n) => entry(n)) } });
check(await changeSavedAnswers(c, 'youth', current => withSavedAnswer(current, entry(99)), signal).then(() => false, error => /högst 8/.test(error.message)) && !c.calls.some(call => call[0] === 'rpc'), 'a full list is refused locally with no write');
c = client({ readError: { code: 'PGRST116' } });
check(await loadSavedAnswers(c, 'youth', signal).then(() => false, error => error instanceof SavedAnswerError), 'a failed read is an error, never an empty list that could overwrite');
c = client({ stored: {} });
check((await changeSavedAnswers(c, 'youth', current => current.filter(() => false), signal)).length === 0, 'removing from an empty list is harmless');
console.log(`saved-answers: ${passed} checks passed`);
