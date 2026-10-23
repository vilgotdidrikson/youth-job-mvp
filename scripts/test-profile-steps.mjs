import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const load = Module._load;
Module._load = function (request, parent, ...rest) { return load.call(this, request.startsWith('./') && parent?.filename?.includes('/lib/') && !request.endsWith('.ts') ? `${request}.ts` : request, parent, ...rest); };
const steps = require('../lib/profile-steps.ts');
const { JOB_CATEGORIES, preferredJobCategories } = require('../lib/job-categories.ts');
const { validateRecruitmentProfile, emptyRecruitmentProfile } = require('../lib/recruitment-profile.ts');
Module._load = load;
const { roleChoices, toggleCategoryRole, addRoles, addListItems, removeListItem, categoryForRole, isStandardTravel, appendSuggestion, JOB_CATEGORY_SHORT_LABELS, PRIMARY_JOB_CATEGORY_IDS, MAX_ROLES } = steps;

// Every category has a short label; 10 are shown before "Visa alla 15".
assert.deepEqual(Object.keys(JOB_CATEGORY_SHORT_LABELS).sort(), JOB_CATEGORIES.map(c => c.id).sort());
assert.equal(PRIMARY_JOB_CATEGORY_IDS.length, 10);

// A chip saves the category's full label, exactly as the old dropdown did, so preferredJobCategories keeps working.
let roles = toggleCategoryRole([], 'cafe');
assert.deepEqual(roles, ['Caféarbete']);
assert.deepEqual(preferredJobCategories(roles), ['cafe']);
roles = toggleCategoryRole(roles, 'supervision');
assert.deepEqual(roles, ['Caféarbete', 'Handledning'], 'Short label "Läxhjälp" still saves the category label');
assert.deepEqual(preferredJobCategories(roles), ['cafe', 'supervision']);
assert.deepEqual(toggleCategoryRole(roles, 'cafe'), ['Handledning'], 'Toggling again removes it');

// Existing own wording stays as its own chip and is never rewritten; the category label or short label selects the chip.
const saved = ['Barista', 'Butiksarbete', 'Kundtjänst', 'fritidsledare'];
const choices = roleChoices(saved);
assert.deepEqual(choices.custom, ['Barista', 'fritidsledare']);
assert.deepEqual(choices.categories.filter(c => c.selected).map(c => c.id), ['retail', 'customer-service']);
assert.equal(categoryForRole('café'), 'cafe'); assert.equal(categoryForRole('CAFÉARBETE'), 'cafe'); assert.equal(categoryForRole('barista'), null);
assert.deepEqual(removeListItem(saved, 'Barista'), ['Butiksarbete', 'Kundtjänst', 'fritidsledare']);

// "+ Eget jobb": own text is kept; a category name selects the category instead of a duplicate chip.
assert.deepEqual(addRoles([], 'Fritidsledare'), ['Fritidsledare']);
assert.deepEqual(addRoles(['Caféarbete'], 'café'), ['Caféarbete'], 'No duplicate of a selected category');
assert.deepEqual(addRoles([], 'lager'), ['Lagerarbete']);
assert.deepEqual(addRoles(['Barista'], 'barista'), ['Barista'], 'Case-insensitive duplicate');

// The limit of 8 holds for chips, own jobs and places.
const eight = JOB_CATEGORIES.slice(0, 8).reduce((list, c) => toggleCategoryRole(list, c.id), []);
assert.equal(eight.length, MAX_ROLES);
assert.deepEqual(toggleCategoryRole(eight, JOB_CATEGORIES[9].id), eight, 'A ninth chip is refused');
assert.deepEqual(addRoles(eight, 'Fritidsledare'), eight);
assert.deepEqual(addListItems(['Solna'], 'Sundbyberg, solna ,  , Kista', 8), ['Solna', 'Sundbyberg', 'Kista'], 'Comma-separated, trimmed, deduplicated');
assert.equal(addListItems([], Array.from({ length: 12 }, (_, i) => `Ort ${i}`).join(','), 8).length, 8);
assert.equal(addListItems([], 'x'.repeat(120), 8)[0].length, 80, 'Items are cut to the validated length');

// Travel: 15/30/45/60 are segments ("60" is 60+); anything else keeps an "Annat" value.
for (const value of ['15', '30', '45', '60']) assert.ok(isStandardTravel(value));
for (const value of ['', '10', '90', '180']) assert.equal(isStandardTravel(value), false);

// Learning suggestions append to the free text without duplicates or exceeding 1000 characters.
assert.equal(appendSuggestion('', 'Kundservice'), 'Kundservice');
assert.equal(appendSuggestion('Lära mig kassan', 'Ta mer ansvar'), 'Lära mig kassan, ta mer ansvar');
assert.equal(appendSuggestion('Jag vill lära mig mycket.', 'Jobba i team'), 'Jag vill lära mig mycket. Jobba i team');
assert.equal(appendSuggestion('Mer kundservice', 'Kundservice'), 'Mer kundservice');
assert.equal(appendSuggestion('x'.repeat(995), 'Ta mer ansvar'), 'x'.repeat(995));

// What the step produces passes the unchanged validation, including categoryIds.
const profile = emptyRecruitmentProfile();
const stepRoles = addRoles(toggleCategoryRole(toggleCategoryRole([], 'cafe'), 'events'), 'Fritidsledare');
const clean = validateRecruitmentProfile({ ...profile, preferences: { roles: stepRoles, categoryIds: preferredJobCategories(stepRoles), locations: addListItems([], 'Solna, Sundbyberg', 8), travelMinutes: '60', motivation: appendSuggestion('', 'Kundservice') } });
assert.deepEqual(clean.preferences, { categoryIds: ['cafe', 'events'], roles: ['Caféarbete', 'Eventarbete', 'Fritidsledare'], locations: ['Solna', 'Sundbyberg'], travelMinutes: '60', motivation: 'Kundservice' });

// The editor keeps the protected save contract and only swaps the preferences markup.
const editor = readFileSync('components/recruitment-profile-editor.tsx', 'utf8');
assert.match(editor, /rpc\("save_my_recruitment_profile", \{ p_section: section, p_value: clean\[section\], p_expected_version: version \}\)/);
assert.match(editor, /failure\.code === "40001" \? "Profilen har ändrats i en annan vy\./);
assert.match(editor, /const leave=\(\)=>\{if\(dirty&&!window\.confirm\(/, 'Skip/cancel still warns about unsaved changes');
assert.match(editor, /onDirtyChange\?\.\(dirty\)/);
assert.match(editor, /onBusyChange\?\.\(true\)/);
assert.match(editor, /addRoles\(commaList\(roles\),pendingRole\)/, 'Text still in "Eget jobb" is saved');
assert.match(editor, /addListItems\(commaList\(locations\),pendingLocation,MAX_LOCATIONS\)/, 'Text still in the place field is saved');
assert.doesNotMatch(editor, /Skilj olika områden med kommatecken/, 'Old free-text job field is gone');
assert.match(editor, /setCompleted\(selected\)/, 'ProfileStepComplete still follows a saved journey step');
console.log('PASS profile steps: chips save full category labels, own wording kept, limits of 8, tags, travel options, learning suggestions, validated output, protected save contract.');
