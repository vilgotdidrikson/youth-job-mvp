import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { jobFieldErrors, firstJobFieldError, jobFieldStep, parseAmount, parseSalaryText, prefillCompanyCity } = require('../lib/job-fields.ts');
const { draftSalary, EMPTY_JOB_FORM } = require('../lib/job-copy.ts');

const fields = (values) => ({ minAge: '', maxAge: '', salaryFrom: '', salaryTo: '', salaryType: 'timlön', ...values });

// F22: empty optional fields are fine; reversed and unreasonable ranges are caught at the field.
assert.deepEqual(jobFieldErrors(fields({})), {});
assert.deepEqual(jobFieldErrors(fields({ minAge: '16', maxAge: '19', salaryFrom: '120', salaryTo: '145' })), {});
assert.deepEqual(jobFieldErrors(fields({ minAge: '16', maxAge: '16' })), {}, 'A single age is a valid span');
assert.equal(jobFieldErrors(fields({ minAge: '19', maxAge: '16' })).maxAge, 'Ålder till kan inte vara lägre än ålder från.');
assert.equal(jobFieldErrors(fields({ minAge: '12' })).minAge, 'Ange en ålder mellan 13 och 30 år.');
assert.equal(jobFieldErrors(fields({ maxAge: '31' })).maxAge, 'Ange en ålder mellan 13 och 30 år.');
assert.equal(jobFieldErrors(fields({ minAge: '1e' })).minAge, 'Ange en ålder mellan 13 och 30 år.');
assert.equal(jobFieldErrors(fields({ minAge: '40', maxAge: '16' })).maxAge, undefined, 'No reversed-range message on top of an invalid value');
assert.equal(jobFieldErrors(fields({ salaryFrom: '145', salaryTo: '120' })).salaryTo, 'Lön till kan inte vara lägre än lön från.');
assert.equal(jobFieldErrors(fields({ salaryFrom: '12,50' })).salaryFrom, 'Skriv beloppet i hela kronor, till exempel 135.');
assert.equal(jobFieldErrors(fields({ salaryFrom: '0' })).salaryFrom, 'Skriv beloppet i hela kronor, till exempel 135.');
assert.match(jobFieldErrors(fields({ salaryFrom: '25000' })).salaryFrom, /ovanligt högt för timlön/, 'Monthly pay typed as hourly');
assert.deepEqual(jobFieldErrors(fields({ salaryType: 'månadslön', salaryFrom: '25 000', salaryTo: '28 000' })), {});
assert.deepEqual(jobFieldErrors(fields({ salaryType: 'fast lön', salaryFrom: '300000' })), {}, 'No upper bound for a fixed amount');
assert.equal(parseAmount('25 000'), 25000);
assert.equal(parseAmount('25 000'), 25000);
assert.equal(parseAmount('abc'), null);
assert.deepEqual(firstJobFieldError({ salaryTo: 'b', maxAge: 'a' }), { field: 'maxAge', message: 'a' });
assert.equal(firstJobFieldError({}), null);
assert.equal(jobFieldStep('minAge'), 1);
assert.equal(jobFieldStep('salaryTo'), 3);

// F10: explicit salary text becomes editable fields; anything vague stays as written.
assert.deepEqual(parseSalaryText('120–145 kr/tim'), { salaryFrom: '120', salaryTo: '145', salaryType: 'timlön' });
assert.deepEqual(parseSalaryText('120 - 145 kr / h'), { salaryFrom: '120', salaryTo: '145', salaryType: 'timlön' });
assert.deepEqual(parseSalaryText('Från 130 kr/tim'), { salaryFrom: '130', salaryTo: '', salaryType: 'timlön' });
assert.deepEqual(parseSalaryText('Upp till 150 kr per timme'), { salaryFrom: '', salaryTo: '150', salaryType: 'timlön' });
assert.deepEqual(parseSalaryText('25 000 kr/mån'), { salaryFrom: '25000', salaryTo: '25000', salaryType: 'månadslön' });
assert.deepEqual(parseSalaryText('3000 kr/period'), { salaryFrom: '3000', salaryTo: '3000', salaryType: 'fast lön' });
for (const vague of ['Enligt kollektivavtal', 'Ca 130 kr/tim', '130', '130 kr', '145–120 kr/tim', '25000 kr/tim', 'Från 120–145 kr/tim', '130 kr/vecka', '']) {
  assert.equal(parseSalaryText(vague), null, vague);
}
// Round trip: what the builder saves can be read back into the same fields.
for (const form of [{ salaryFrom: '120', salaryTo: '145', salaryType: 'timlön' }, { salaryFrom: '130', salaryTo: '', salaryType: 'timlön' }, { salaryFrom: '', salaryTo: '28000', salaryType: 'månadslön' }, { salaryFrom: '130', salaryTo: '130', salaryType: 'timlön' }]) {
  const text = draftSalary({ ...EMPTY_JOB_FORM, ...form });
  assert.deepEqual(parseSalaryText(text), form, text);
}
assert.equal(draftSalary({ ...EMPTY_JOB_FORM, salaryFrom: '130', salaryTo: '130' }), '130 kr/tim', 'Equal amounts are shown once');

// F10: a new listing starts in the company's city; nothing filled in is overwritten.
const blank = { ...EMPTY_JOB_FORM, title: 'QA-jobb' };
assert.equal(prefillCompanyCity(blank, ' Uppsala ', false).city, 'Uppsala');
assert.equal(prefillCompanyCity(blank, '', false), blank);
assert.equal(prefillCompanyCity(blank, null, false), blank);
assert.equal(prefillCompanyCity(blank, 'Uppsala', true), blank, 'Editing keeps the saved city');
assert.equal(prefillCompanyCity({ ...blank, copiedFromTitle: 'Gammal' }, 'Uppsala', false).city, '', 'Copies keep their own workplaces');
assert.equal(prefillCompanyCity({ ...blank, city: 'Malmö' }, 'Uppsala', false).city, 'Malmö');
assert.equal(prefillCompanyCity({ ...blank, workplaces: [{ id: 'x', city: '' }] }, 'Uppsala', false).workplaces.length, 1);
assert.equal(prefillCompanyCity({ ...blank, workplaces: [{ id: 'x', city: '' }] }, 'Uppsala', false).city, '');

// Wiring in the builder.
const page = readFileSync('app/company/page.tsx', 'utf8');
assert.equal((page.match(/onClick=\{openPreview\}>Förhandsvisa/g) ?? []).length, 2, 'Both preview buttons validate first');
assert.equal((page.match(/setPreviewOpen\(true\)/g) ?? []).length, 1, 'Only openPreview opens the preview');
assert.match(page, /const openPreview = \(\) => \{ if \(fieldsAreValid\(\)\) setPreviewOpen\(true\); \};/);
assert.match(page, /if \(!fieldsAreValid\(\["minAge", "maxAge"\]\)\) return;/, 'Step 1 cannot be left with a wrong age');
assert.match(page, /if \(!fieldsAreValid\(\)\) return false;\n    if \(generatingAi\)/, 'Publishing and saving edits validate the fields');
assert.match(page, /prefillCompanyCity\(form, companyProfile\?\.city, editing\)/);
assert.match(page, /\{\.\.\.fieldProps\("minAge"\)\}/);
assert.match(page, /\{\.\.\.fieldProps\("salaryTo"\)\}/);
assert.equal(page.includes('type="number" min="13" max="30"'), false, 'Browser-language number bubbles replaced by Swedish field errors');
assert.match(page, /Fyll i lönefälten/);
assert.match(page, /role="alert">\{fieldError\(field\)\}/);
console.log('PASS job fields: age/salary ranges with Swedish field errors, blocked preview/step/save, explicit salary text to fields, company city prefill without overwrite.');
