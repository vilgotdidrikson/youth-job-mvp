import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const review = require('../lib/job-ai-review.ts');
const { extractJobFacts, transferJobFacts, splitGroundedMustHaves, summarizeAiChanges, applyAiJobSuggestion, addMustHave, ageLabel } = review;
const { EMPTY_JOB_FORM } = require('../lib/job-copy.ts');
const form = (values = {}) => ({ ...EMPTY_JOB_FORM, title: 'QA-butiksjobb', ...values });

// Explicit age and salary in the employer's own text.
assert.deepEqual(extractJobFacts('Du är 16–19 år och kan jobba helger.').age, { minAge: '16', maxAge: '19' });
assert.deepEqual(extractJobFacts('Du måste ha fyllt 18 år.').age, { minAge: '18', maxAge: '' });
assert.deepEqual(extractJobFacts('Minst 16 år.').age, { minAge: '16', maxAge: '' });
assert.deepEqual(extractJobFacts('Sökande 18 år eller äldre.').age, { minAge: '18', maxAge: '' });
assert.deepEqual(extractJobFacts('Högst 25 år.').age, { minAge: '', maxAge: '25' });
assert.deepEqual(extractJobFacts('Lön 130 kr/tim.').salary, { salaryFrom: '130', salaryTo: '130', salaryType: 'timlön' });
assert.deepEqual(extractJobFacts('Timlönen är 120–145 kr i timmen').salary, { salaryFrom: '120', salaryTo: '145', salaryType: 'timlön' });
assert.deepEqual(extractJobFacts('Från 135 kronor per timme').salary, { salaryFrom: '135', salaryTo: '', salaryType: 'timlön' });
assert.deepEqual(extractJobFacts('Månadslön 25 000 kr/mån').salary, { salaryFrom: '25000', salaryTo: '25000', salaryType: 'månadslön' });
// Not ages or salaries, or unclear: nothing is moved.
assert.equal(extractJobFacts('Minst 15 års erfarenhet krävs inte. Vi har funnits i 30 år.').age, null);
assert.equal(extractJobFacts('Personalrabatt 100 kr och belöning varje månad.').salary, null);
assert.deepEqual(extractJobFacts('Personalrabatt 100 kr och belöning varje månad.').review, [], 'A discount is not a salary mention');
const over = extractJobFacts('Du ska vara över 18 år.');
assert.equal(over.age, null); assert.match(over.review[0], /över eller under/);
const both = extractJobFacts('Du är 16–19 år. Minst 18 år för kassan.');
assert.equal(both.age, null); assert.match(both.review.join(' '), /flera åldrar \(16–19 år, minst 18 år\)/);
assert.match(extractJobFacts('Ålder 12–40 år').review.join(' '), /inte är ett giltigt spann/);
assert.match(extractJobFacts('Lön enligt kollektivavtal.').review.join(' '), /nämner lön utan tydligt belopp/);
assert.match(extractJobFacts('Lön 145–120 kr/tim').review.join(' '), /omvänt intervall/);
assert.match(extractJobFacts('130 kr/tim vardagar, 160 kr/tim helger').review.join(' '), /flera löner \(130 kr\/tim, 160 kr\/tim\)/);
assert.equal(ageLabel({ minAge: '16', maxAge: '16' }), '16 år');

// Transfer fills empty fields and never overwrites; disagreements are flagged.
const facts = extractJobFacts('Du är 16–19 år. Lön 130 kr/tim.');
let moved = transferJobFacts(form(), facts);
assert.deepEqual([moved.form.minAge, moved.form.maxAge, moved.form.salaryFrom, moved.form.salaryTo], ['16', '19', '130', '130']);
assert.deepEqual(moved.transferred, ['Ålder: 16–19 år', 'Lön: 130 kr/tim']);
moved = transferJobFacts(form({ minAge: '18', salaryFrom: '150', salaryTo: '' }), facts);
assert.equal(moved.form.minAge, '18'); assert.equal(moved.form.salaryFrom, '150');
assert.deepEqual(moved.transferred, []);
assert.match(moved.review.join(' '), /Texten anger 16–19 år men åldersfälten anger minst 18 år/);
assert.match(moved.review.join(' '), /Texten anger 130 kr\/tim men lönefälten anger Från 150 kr\/tim/);
assert.deepEqual(transferJobFacts(form({ minAge: '16', maxAge: '19', salaryFrom: '130', salaryTo: '130' }), facts).review, [], 'Matching values are not flagged');
assert.equal(transferJobFacts(form({ salaryText: 'Enligt avtal' }), facts).form.salaryFrom, '', 'Copied salary text is not replaced');

// Only requirements the employer listed become absolute; the rest are suggestions.
assert.deepEqual(splitGroundedMustHaves(['B-körkort', 'Kan arbeta helger', 'Tidigare erfarenhet'], ['B körkort', 'Svenska']), { mustHaves: ['B körkort'], suggestedMustHaves: ['Kan arbeta helger', 'Tidigare erfarenhet'] });
assert.deepEqual(splitGroundedMustHaves(['Kan arbeta helger'], []), { mustHaves: [], suggestedMustHaves: ['Kan arbeta helger'] });
assert.equal(addMustHave('B-körkort', 'Kan arbeta helger'), 'B-körkort, Kan arbeta helger');
assert.equal(addMustHave('B-körkort', 'b körkort'), 'B-körkort');

// The actual apply: chosen employment type kept, facts from employer text, summary split.
const before = form({ description: 'Butiksjobb för dig som är 16–19 år. Lön 130 kr/tim.', employmentType: 'Timanställning', listingRequirements: 'B-körkort' });
const data = { source: 'ai', employmentType: 'Deltid', description: 'Välkommen till vår butik! Du får 999 kr/tim och är 20–25 år.', benefits: ['Personalrabatt'], suggestedMustHaves: ['Kan arbeta helger'], matchProfile: { mustHaves: ['B-körkort'], trainableRequirements: ['Kassa'], topTraits: ['Social'], candidateQuestions: ['Kan du jobba lördagar?'] } };
const { patch, review: summary } = applyAiJobSuggestion(before, data);
assert.equal(patch.employmentType, undefined, 'An employer-chosen employment type is never replaced');
assert.deepEqual([patch.minAge, patch.maxAge, patch.salaryFrom], ['16', '19', '130'], 'Facts come from the employer text, never from AI output');
assert.equal(patch.requirements, 'B-körkort');
assert.equal(patch.aiGenerated, true);
assert.equal(patch.salaryText, undefined);
assert.deepEqual(summary.listing.map(item => item.label), ['Beskrivning', 'Förmåner']);
assert.deepEqual(summary.matching.map(item => item.label), ['Absoluta krav', 'Kan läras på plats', 'Viktiga egenskaper', 'Frågor till sökande']);
assert.deepEqual(summary.transferred, ['Ålder: 16–19 år', 'Lön: 130 kr/tim']);
assert.deepEqual(summary.suggestedMustHaves, ['Kan arbeta helger']);
assert.equal(applyAiJobSuggestion(form(), { ...data, matchProfile: {} }).patch.employmentType, 'Deltid', 'AI may fill an empty employment type');
assert.match(applyAiJobSuggestion(form(), { ...data, matchProfile: {} }).review.listing.find(item => item.label === 'Anställningsform').value, /förslag/);
const untouched = applyAiJobSuggestion(form({ salaryFrom: '140' }), { source: 'fallback' }).patch;
assert.deepEqual(Object.keys(untouched), ['aiGenerated'], 'Only changed fields are merged, so edits during generation survive');
assert.deepEqual(summarizeAiChanges(form(), form(), { transferred: [], review: [], suggestedMustHaves: [] }), { listing: [], matching: [], transferred: [], review: [], suggestedMustHaves: [] });

// The route grounds AI requirements and no longer guesses an employment type.
const compile = (file, imports) => { const compiledModule = { exports: {} }; const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function('module', 'exports', 'require', code + '\nexports.fixture={fallback,normalizeResult};')(compiledModule, compiledModule.exports, name => imports[name] ?? require(name)); return compiledModule.exports.fixture; };
const route = compile('app/api/company/job/generate/route.ts', { '@/lib/job-categories': require('../lib/job-categories.ts'), '@/lib/job-ai-review': review, '@/lib/server-failures': require('../lib/server-failures.ts'), '@/lib/api-auth': {}, '@/lib/openai-config': {}, 'next/server': {} });
assert.equal(route.fallback('Kassabiträde', '', {}).employmentType, '', 'No silent Deltid without AI');
assert.equal(route.fallback('Kassabiträde', '', { employmentType: 'Timanställning' }).employmentType, 'Timanställning');
const normalized = route.normalizeResult({ matchProfile: { mustHaves: ['B-körkort', 'Kan arbeta helger'] } }, route.fallback('Kassabiträde', '', {}), ['B-körkort']);
assert.deepEqual(normalized.matchProfile.mustHaves, ['B-körkort']);
assert.deepEqual(normalized.suggestedMustHaves, ['Kan arbeta helger']);
const source = readFileSync('app/api/company/job/generate/route.ts', 'utf8');
assert.match(source, /Arbetsform och arbetstider.*är villkor i annonsen och inte absoluta krav/);
assert.match(source, /normalizeResult\(JSON\.parse\(content\), safeFallback, cleanList\(body\.requirements, 6\)\)/);

// Wiring in the builder.
const page = readFileSync('app/company/page.tsx', 'utf8');
assert.match(page, /const \{ patch, review \} = applyAiJobSuggestion\(form, data\);\n      setForm\(\(previous\) => \(\{ \.\.\.previous, \.\.\.patch \}\)\);/);
assert.match(page, /\{shownAiReview && <JobAiReviewPanel/);
assert.match(page, /listingRequirements: addMustHave\(current\.listingRequirements \?\? current\.requirements, item\)/, 'An accepted requirement is also shown in the listing');
assert.match(page, /setAiReview\(null\);\n      try \{ await jobDraft\.clear\(\); \}/, 'Review is cleared after publishing');
const panel = readFileSync('components/job-ai-review-panel.tsx', 'utf8');
assert.match(panel, /I annonsen – syns för sökande/);
assert.match(panel, /I matchningen – internt, syns inte i annonsen/);
console.log('PASS AI job review: explicit age/salary from employer text only, no overwrite, review flags, grounded requirements with suggestions, kept employment type, change summary and builder wiring.');
