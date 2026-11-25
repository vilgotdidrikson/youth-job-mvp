import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const load = Module._load;
Module._load = function (request, parent, ...rest) { return load.call(this, request.startsWith('./') && parent?.filename?.includes('/lib/') && !request.endsWith('.ts') ? `${request}.ts` : request, parent, ...rest); };
const p = require('../lib/job-practical.ts');
const { jobBuilderFields, restoreJobBuilderDraft, EMPTY_JOB_FORM } = require('../lib/job-copy.ts');
const { jobEditUpdates } = require('../lib/job-edit.ts');
Module._load = load;

// Dates are real calendar dates.
assert.ok(p.isIsoDate('2027-02-28')); assert.ok(!p.isIsoDate('2027-02-30')); assert.ok(!p.isIsoDate('28/2/2027'));

// Everything empty means nothing is saved or shown.
assert.deepEqual(p.practicalPayload(p.EMPTY_PRACTICAL_FORM), {});
assert.deepEqual(p.practicalFacts({}), []);

// A full form round-trips through the saved shape.
const form = { startMode: 'date', startDate: '2027-06-01', hoursMin: '10', hoursMax: '15', times: ['weekend', 'evening'], periodMode: 'until', periodEnd: '2027-08-15', deadline: '2027-05-15' };
const saved = p.practicalPayload(form);
assert.deepEqual(saved, { start: { mode: 'date', date: '2027-06-01' }, hours: { min: 10, max: 15 }, times: ['evening', 'weekend'], period: { mode: 'until', endDate: '2027-08-15' }, deadline: '2027-05-15' });
assert.deepEqual(p.practicalForm(saved), { ...form, times: ['evening', 'weekend'] });
assert.deepEqual(p.practicalFacts(saved, '2027-05-01'), [
  { label: 'Start', value: 'Från 1 juni 2027' },
  { label: 'Omfattning', value: '10–15 tim/vecka · Kvällar, Helger' },
  { label: 'Anställningsperiod', value: 'Tidsbegränsad till 15 augusti 2027' },
  { label: 'Sista ansökningsdag', value: '15 maj 2027' },
]);
assert.equal(p.practicalFacts(saved, '2027-05-16').at(-1).value, '15 maj 2027 (har passerat)');
assert.deepEqual(p.practicalFacts({ start: { mode: 'asap' }, hours: { max: 20 }, period: { mode: 'ongoing' } }).map(f => f.value), ['Så snart som möjligt', 'Upp till 20 tim/vecka', 'Tills vidare']);
assert.equal(p.practicalFacts({ hours: { min: 8, max: 8 } })[0].value, '8 tim/vecka');

// Validation: needed dates, hour range, order and a new deadline in the past.
assert.deepEqual(p.practicalErrors(form, '2027-05-01'), {});
const e = p.practicalErrors({ ...form, startDate: '', hoursMin: '70', periodEnd: '2027-05-01', deadline: '2027-04-01' }, '2027-05-01');
assert.equal(e.startDate, 'Välj ett startdatum eller ett annat startalternativ.');
assert.equal(e.hoursMin, 'Ange timmar per vecka mellan 1 och 60.');
assert.equal(e.deadline, 'Sista ansökningsdag kan inte ha passerat.');
assert.equal(p.practicalErrors({ ...form, hoursMin: '20', hoursMax: '10' }).hoursMax, 'Timmar till kan inte vara färre än timmar från.');
assert.equal(p.practicalErrors({ ...form, periodEnd: '2027-05-01' }).periodEnd, 'Anställningen kan inte sluta före startdatumet.');
assert.equal(p.practicalErrors({ ...form, periodEnd: '' }).periodEnd, 'Välj sista dag för anställningen eller ett annat alternativ.');
assert.deepEqual(p.practicalErrors({ ...form, deadline: '2027-04-01' }), {}, 'Without today (editing) a passed deadline is kept');
assert.equal(p.firstPracticalError(e).field, 'startDate');

// Saved values from the database are read tolerantly; unknown or broken parts are dropped.
assert.deepEqual(p.readPracticalDetails({ start: { mode: 'date', date: 'snart' }, hours: { min: 0, max: 99 }, times: ['weekend', 'night'], period: { mode: 'forever' }, deadline: '2027-13-01', extra: 'x' }), { times: ['weekend'] });
assert.deepEqual(p.readPracticalDetails(null), {});
assert.deepEqual(p.readPracticalDetails([]), {});

// Browser drafts: half-filled text is kept, junk is dropped, old drafts without the field get the empty form.
assert.deepEqual(restoreJobBuilderDraft({ title: 'Gammalt utkast' }).practical, p.EMPTY_PRACTICAL_FORM);
assert.deepEqual(restoreJobBuilderDraft({ practical: { startMode: 'date', startDate: '2027-0', times: ['evening', 'x'], periodMode: 'nope', deadline: 5 } }).practical, { ...p.EMPTY_PRACTICAL_FORM, startMode: 'date', startDate: '2027-0', times: ['evening'] });

// Copy and edit start from the saved details; an untouched edit sends no practical update, a change sends only it.
const job = { id: 'j1', title: 'Kassa', description: 'Kassa', category: '', employment_type: 'Deltid', min_age: null, max_age: null, salary_per_hour: '', benefits: '', requirements: '', image_url: '', job_category_ids: [], job_category_manual: false, practical_details: saved };
const workplaces = [{ id: 'w1', name: '', address: 'Gatan 1', postal_code: '12345', city: 'Solna' }];
const baseline = jobBuilderFields(job, null, workplaces);
assert.deepEqual(baseline.practical, p.practicalForm(saved));
assert.equal(jobBuilderFields({ ...job, practical_details: undefined }, null, workplaces).practical.startMode, '');
assert.ok(!('practical_details' in jobEditUpdates(baseline, baseline, [])));
const withoutDeadline = { ...saved }; delete withoutDeadline.deadline;
assert.deepEqual(jobEditUpdates(baseline, { ...baseline, practical: { ...baseline.practical, deadline: '' } }, []), { practical_details: withoutDeadline }, 'Only the changed practical details are sent');
assert.ok(Object.hasOwn(EMPTY_JOB_FORM, 'practical'));

// The listing, builder and data layer are wired; the migration only adds a checked JSON column.
const jobs = readFileSync('lib/jobs.ts', 'utf8');
assert.equal((jobs.match(/"practical_details",/g) ?? []).length, 2, 'Allowed in table and create fields');
assert.match(jobs, /practical_details: readPracticalDetails\(row\.practical_details\)/);
assert.match(jobs, /if \(Object\.keys\(practical\)\.length\) payload\.practical_details = practical;/, 'Create sends non-empty details');
assert.match(jobs, /practical_details: updates\.practical_details === undefined \? undefined : readPracticalDetails\(updates\.practical_details\)/, 'Update sends changed details');
const page = readFileSync('app/company/page.tsx', 'utf8');
assert.match(page, /practical_details: practicalPayload\(form\.practical\)/);
assert.match(page, /practicalErrors\(form\.practical, editing \? undefined : localIsoDate\(\)\)/);
assert.match(readFileSync('app/jobb/[jobId]/page.tsx', 'utf8'), /practicalFacts\(job\.practical_details \?\? \{\}, localIsoDate\(\)\)/);
const sql = readFileSync('supabase/migrations/20261025140000_n05_job_practical_details.sql', 'utf8').replace(/--.*$/gm, '');
assert.match(sql, /add column if not exists practical_details jsonb not null default '\{\}'::jsonb/);
assert.match(sql, /jsonb_typeof\(practical_details\) = 'object'/);
assert.doesNotMatch(sql, /policy|drop column|update public\.jobs set/i);
console.log('PASS job practical details: dates, empty means nothing shown, round trip, facts, validation, tolerant reads, drafts, copy/edit changed-only, wiring and additive migration.');
