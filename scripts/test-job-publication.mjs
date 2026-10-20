import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
const { jobPublicationAction, jobPublicationState, jobPublicationReceipt, jobPublicationLabel } = require('../lib/job-publication.ts');
const { createdCompanyJobHref } = require('../lib/company-navigation.ts');
for (const status of ['pending', 'rejected', undefined, null, 'unexpected']) {
  const action = jobPublicationAction(status);
  assert.equal(action.label, 'Spara inför publicering');
  assert.equal(action.busyLabel, 'Sparar annons…');
  assert.match(action.description, /syns inte.*innan företaget är godkänt/);
  assert.match(action.description, /Pausade och stängda/);
  assert.match(action.previewNote, /Spara utkast behåller den bara på den här enheten/);
}
assert.equal(jobPublicationAction('verified').label, 'Publicera annons');
assert.match(jobPublicationAction('rejected').description, /kompletteras/);
const active = { status: 'active', is_active: true, publication_status: 'published' };
const waiting = { ...active, publication_status: 'pending_verification' };
assert.equal(jobPublicationState(active), 'published');
assert.equal(jobPublicationState(waiting), 'waiting');
assert.match(jobPublicationReceipt(waiting), /väntar på företagsverifiering/);
assert.match(jobPublicationReceipt(waiting), /publiceras den automatiskt/);
for (const status of ['paused', 'closed']) for (const publication_status of ['pending_verification', 'published']) {
  const job = { ...active, status, is_active: false, publication_status };
  assert.equal(jobPublicationState(job), status);
  assert.match(jobPublicationReceipt(job), /syns inte/);
  assert.notEqual(jobPublicationLabel(job), 'Publicerad');
}
assert.equal(jobPublicationState({ ...active, publication_status: undefined }), 'unknown');
assert.match(jobPublicationReceipt({}), /kunde inte bekräftas/);
assert.equal(jobPublicationState({ ...active, is_active: false }), 'paused');
assert.equal(createdCompanyJobHref('qa/id?x'), '/company?view=annonser&created=qa%2Fid%3Fx');

// A missing or unrecognized database value must not normalize to published.
const module = { exports: {} };
const source = ts.transpileModule(readFileSync('lib/jobs.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', 'require', source + '\nexports.normalizeFixture=normalizeJob;')(module, module.exports, name => name.startsWith('@/') ? {} : require(name));
for (const publication_status of [undefined, null, 'new-unrecognized-state']) assert.equal(module.exports.normalizeFixture({ publication_status }).publication_status, undefined);
assert.equal(module.exports.normalizeFixture({ publication_status: 'pending_verification' }).publication_status, 'pending_verification');

const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) { return originalLoad.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest); };
try {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { JobPreviewDialog } = require('../components/job-preview-dialog.tsx');
  const { JobPublicationNotice } = require('../components/job-publication-notice.tsx');
  const form = { title: 'QA jobb', description: 'QA beskrivning', employmentType: 'Deltid', minAge: '', maxAge: '', requirements: '', benefits: '', address: 'QA Jobbgatan 1', postalCode: '11111', city: 'QA' };
  for (const verificationStatus of ['pending', 'rejected', undefined, 'verified']) {
    const html = renderToStaticMarkup(React.createElement(JobPreviewDialog, { form, companyName: 'QA company', salary: '', verificationStatus, onClose() {} }));
    assert.ok(html.includes(jobPublicationAction(verificationStatus).previewNote));
  }
  // Cached company approval is irrelevant: the actual returned job is waiting.
  const html = renderToStaticMarkup(React.createElement(JobPublicationNotice, { job: { ...waiting, title: 'QA sparad annons' } }));
  assert.ok(html.includes('väntar på företagsverifiering'));
  assert.ok(!html.includes('Annonsen är publicerad och synlig'));
} finally { Module._load = originalLoad; }
console.log('PASS verification-aware actions/actual preview, server-state receipt, paused/closed/unknown states, safe normalization and creation redirect.');
