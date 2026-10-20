import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = () => {};
const {
  parseOrganizationNumber, companyVerificationState, companyVerificationSummary, missingVerificationFields,
  verificationSteps, changeRequiresReverification, organizationNumberForSave,
} = require('../lib/company-verification.ts');

// Valid numbers: aktiebolag, ideella föreningar/UF entities in Skatteverket's 8-series, sole trader personal number.
for (const [input, canonical] of [
  ['556016-0680', '556016-0680'],
  ['5560160680', '556016-0680'],
  [' 556016 0680 ', '556016-0680'],
  ['16556016-0680', '556016-0680'],
  ['802471-6162', '802471-6162'],
  ['867800-7918', '867800-7918'],
  ['811218-9876', '811218-9876'],
]) {
  const result = parseOrganizationNumber(input);
  assert.deepEqual(result, { ok: true, value: canonical }, input);
}
// Obviously unreasonable numbers must not look valid.
for (const input of ['', '123', '556016-0681', '000000-0000', '111111-1111', '551500-0007', '550000-0009', '12345678901', '17556016-0680', 'abcdef-ghij']) {
  const result = parseOrganizationNumber(input);
  assert.equal(result.ok, false, input);
  assert.ok(result.error.length > 10);
}
assert.match(parseOrganizationNumber('').error, /Ange organisationsnummer/);
assert.match(parseOrganizationNumber('556016-0681').error, /stämmer inte/);

const complete = { company_name: 'QA Testföretaget AB', organization_number: '556016-0680', administrator: 'QA Admin', verification_submitted_at: '2026-10-20T08:00:00Z' };
// Missing details are never presented as a submitted application.
assert.equal(companyVerificationState({ ...complete, verification_status: 'pending', organization_number: null }), 'missing');
assert.equal(companyVerificationState({ ...complete, verification_status: 'pending', administrator: ' ' }), 'missing');
assert.equal(companyVerificationState({ ...complete, verification_status: 'pending', organization_number: '556016-0681' }), 'missing');
assert.deepEqual(missingVerificationFields({ verification_status: 'pending' }), ['Företagsnamn', 'Giltigt organisationsnummer', 'Kontaktperson (administratör)']);
assert.equal(companyVerificationState({ ...complete, verification_status: 'pending' }), 'submitted');
assert.equal(companyVerificationState({ ...complete, verification_status: 'rejected' }), 'needs_completion');
assert.equal(companyVerificationState({ ...complete, verification_status: 'verified' }), 'verified');
for (const verification_status of [undefined, null, 'unexpected']) assert.equal(companyVerificationState({ ...complete, verification_status }), 'unknown');
assert.equal(companyVerificationState(null), 'unknown');

const missing = companyVerificationSummary({ verification_status: 'pending', company_name: 'QA' });
assert.equal(missing.title, 'Uppgifter saknas');
assert.match(missing.body, /inte inskickat/);
assert.deepEqual(missing.missing, ['Giltigt organisationsnummer', 'Kontaktperson (administratör)']);
const submitted = companyVerificationSummary({ ...complete, verification_status: 'pending' });
assert.equal(submitted.title, 'Inskickat – under granskning');
assert.match(submitted.body, /skickades in 20 oktober 2026/);
assert.match(submitted.body, /manuellt i den ordning/);
assert.doesNotMatch(submitted.body, /arbetsdag|timmar|inom \d/); // No handling time is promised.
const rejected = companyVerificationSummary({ ...complete, verification_status: 'rejected', verification_rejection_reason: 'QA: numret matchar inte namnet.' });
assert.equal(rejected.title, 'Behöver kompletteras');
assert.match(rejected.body, /QA: numret matchar inte namnet\./);
assert.match(companyVerificationSummary({ ...complete, verification_status: 'rejected' }).body, /fler eller rättade uppgifter/);
assert.equal(companyVerificationSummary({ ...complete, verification_status: 'verified' }).title, 'Godkänt företag');
assert.match(companyVerificationSummary({ verification_status: 'odd' }).title, /kunde inte kontrolleras/);
assert.equal(companyVerificationSummary({ ...complete, verification_status: 'pending', verification_submitted_at: 'not a date' }).submittedOn, null);

assert.deepEqual(verificationSteps('submitted').map((step) => [step.done, step.current]), [[true, false], [true, false], [false, true], [false, false]]);
assert.deepEqual(verificationSteps('missing').map((step) => step.current), [true, false, false, false]);
assert.ok(verificationSteps('verified').every((step) => step.done));
assert.deepEqual(verificationSteps('needs_completion'), []);
assert.deepEqual(verificationSteps('unknown'), []);

// Only an approved company is warned, and only when the digits change.
assert.equal(changeRequiresReverification({ verification_status: 'verified', organization_number: '5560160680' }, '556016-0680'), false);
assert.equal(changeRequiresReverification({ verification_status: 'verified', organization_number: '556016-0680' }, '802471-6162'), true);
assert.equal(changeRequiresReverification({ verification_status: 'verified', organization_number: '556016-0680' }, ''), true);
assert.equal(changeRequiresReverification({ verification_status: 'pending', organization_number: '556016-0680' }, '802471-6162'), false);
// The trigger compares stored text: an unchanged number keeps its stored spelling.
assert.equal(organizationNumberForSave('5560160680', '556016-0680'), '5560160680');
assert.equal(organizationNumberForSave('556016-0680', '802471-6162'), '802471-6162');
assert.equal(organizationNumberForSave(null, '556016-0680'), '556016-0680');

const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) { return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest); };
try {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { CompanyVerificationStatus } = require('../components/company-verification-status.tsx');
  const render = (profile, props = {}) => renderToStaticMarkup(React.createElement(CompanyVerificationStatus, { profile, ...props }));
  const missingHtml = render({ verification_status: 'pending', company_name: 'QA' }, { action: { href: '/profile?tab=details', label: 'Kontrollera företagsuppgifter' } });
  assert.match(missingHtml, /Uppgifter saknas/);
  assert.match(missingHtml, /Krävs för granskning/);
  assert.match(missingHtml, /Giltigt organisationsnummer/);
  assert.match(missingHtml, /aria-current="step"/);
  assert.match(missingHtml, /får du en notis/);
  assert.match(missingHtml, /href="\/profile\?tab=details"/);
  // Collapsible: native details/summary, open by default, status visible while minimized.
  assert.match(missingHtml, /^<details[^>]*open=""/);
  assert.match(missingHtml, /<summary>[\s\S]*Uppgifter saknas[\s\S]*Åtgärd krävs[\s\S]*Minimera[\s\S]*<\/summary>/);
  assert.match(missingHtml, /is-missing/);
  const submittedHtml = render({ ...complete, verification_status: 'pending' }, { compact: true });
  assert.match(submittedHtml, /Inskickat – under granskning/);
  assert.match(submittedHtml, /Granskas av MatchnWork/);
  assert.doesNotMatch(submittedHtml, /Krävs för granskning/);
  assert.doesNotMatch(submittedHtml, /får du en notis/); // Compact view omits the long help text.
  const rejectedHtml = render({ ...complete, verification_status: 'rejected', verification_rejection_reason: 'QA <b>orsak</b>' });
  assert.match(rejectedHtml, /QA &lt;b&gt;orsak&lt;\/b&gt;/); // Admin text is escaped, not rendered as markup.
  assert.doesNotMatch(rejectedHtml, /company-verification-steps/);
  const verifiedHtml = render({ ...complete, verification_status: 'verified' }, { action: { href: '/profile', label: 'Kontrollera' } });
  assert.match(verifiedHtml, /Godkänt företag/);
  assert.doesNotMatch(verifiedHtml, /Kontrollera/);
} finally { Module._load = originalLoad; }

// Every entry point must use the shared validation instead of the old format-only regex.
for (const file of ['app/profile/page.tsx', 'app/company/onboarding/page.tsx']) {
  const source = readFileSync(file, 'utf8');
  assert.ok(source.includes('parseOrganizationNumber('), file);
  assert.ok(!source.includes('\\d{6}-?\\d{4}'), file);
}
console.log('PASS organisation number checksum/UF/sole trader, five-state verification summary, no promised handling time, re-verification guard, stored-spelling preservation and rendered status card.');
