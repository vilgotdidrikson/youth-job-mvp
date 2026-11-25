import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const b = require('../lib/job-benefits.ts');
const { applyAiJobSuggestion } = require('../lib/job-ai-review.ts');
const { EMPTY_JOB_FORM } = require('../lib/job-copy.ts');

// Equivalent wordings are one benefit; unrelated ones are not.
assert.equal(b.benefitKey('Lunch under arbetspasset'), b.benefitKey('Måltid ingår'));
assert.equal(b.benefitKey('Fri lunch'), b.benefitKey('Mat ingår'));
assert.equal(b.benefitKey('Flexibelt schema'), b.benefitKey('Flexibla tider'));
assert.equal(b.benefitKey('Introduktionsutbildning'), b.benefitKey('Introduktion'));
assert.equal(b.benefitKey('Friskvård'), b.benefitKey('Friskvårdsbidrag'));
assert.equal(b.benefitKey('personalrabatt'), b.benefitKey('Personalrabatt'));
assert.notEqual(b.benefitKey('Kurs i matlagning'), b.benefitKey('Måltid ingår'), '"matlagning" is not a meal');
assert.notEqual(b.benefitKey('Arbetskläder'), b.benefitKey('Personalrabatt'));
assert.equal(b.benefitKey('  Gratis   PARKERING '), b.benefitKey('gratis parkering'));

// The first wording wins and later equivalents disappear.
assert.deepEqual(b.mergeBenefits(['Måltid ingår', 'Lunch under arbetspasset', 'Arbetskläder', ' ', 'arbetskläder']), ['Måltid ingår', 'Arbetskläder']);
assert.deepEqual(b.benefitItems('A, B\nC,,'), ['A', 'B', 'C']);

// AI suggestions keep the employer's choices and only add new benefits, capped.
assert.equal(b.mergeSuggestedBenefits('Måltid ingår', ['Lunch under arbetspasset', 'Personalrabatt']), 'Måltid ingår, Personalrabatt');
assert.equal(b.mergeSuggestedBenefits('', ['Lunch under arbetspasset', 'Måltid ingår']), 'Lunch under arbetspasset');
assert.equal(b.mergeSuggestedBenefits('Egen förmån', []), 'Egen förmån');
assert.equal(b.benefitItems(b.mergeSuggestedBenefits('', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).length, b.MAX_SUGGESTED_BENEFITS);
const own = 'A, B, C, D, E, F, G';
assert.equal(b.mergeSuggestedBenefits(own, ['H']), own, 'the employer keeps all own benefits; AI adds none past the cap');

// Builder helpers: chips find equivalents, toggling removes every equivalent, adding never duplicates.
assert.equal(b.hasBenefit('Lunch under arbetspasset', 'Måltid ingår'), true);
assert.equal(b.listedBenefit('Lunch under arbetspasset, Introduktion', 'Måltid ingår'), 'Lunch under arbetspasset');
assert.equal(b.listedBenefit('Introduktion', 'Måltid ingår'), null);
assert.equal(b.toggleBenefit('Lunch under arbetspasset, Introduktion', 'Måltid ingår'), 'Introduktion');
assert.equal(b.toggleBenefit('Introduktion', 'Måltid ingår'), 'Introduktion, Måltid ingår');
assert.equal(b.addBenefit('Måltid ingår', 'Fri lunch'), 'Måltid ingår');
assert.equal(b.removeBenefit('Arbetskläder, Introduktion', 'arbetskläder'), 'Introduktion');
assert.deepEqual(b.customBenefits('Lunch under arbetspasset, Arbetskläder, Flexibla tider, Gratis parkering'), ['Arbetskläder', 'Gratis parkering']);

// The AI suggestion in the builder merges instead of replacing.
const { patch } = applyAiJobSuggestion({ ...EMPTY_JOB_FORM, title: 'QA-kafé', benefits: 'Måltid ingår, Arbetskläder' }, { source: 'ai', benefits: ['Lunch under arbetspasset', 'Personalrabatt'] });
assert.equal(patch.benefits, 'Måltid ingår, Arbetskläder, Personalrabatt');

console.log('PASS job benefits: equivalent wordings merged, employer choices kept before AI suggestions, capped suggestions, builder toggle/add/remove and custom list.');
