import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { COMPANY_ROUTES, companyView, profileTabFromQuery } = require('../lib/company-navigation.ts');
for (const verified of [true, false]) {
  for (const view of ['annonser', 'skapa', 'kandidater']) assert.equal(companyView(view, verified), view);
  for (const view of [null, '', 'unknown', 'https://example.invalid']) assert.equal(companyView(view, verified), 'annonser');
}
assert.equal(companyView('swipe', true), 'kandidater');
assert.equal(companyView('swipe', false), 'skapa');
for (const tab of ['work', 'cv', 'details', 'settings']) assert.equal(profileTabFromQuery(tab), tab);
for (const tab of [null, '', 'overview', 'unknown']) assert.equal(profileTabFromQuery(tab), 'overview');

// Execute the actual JSX navigation callbacks, not copies of their destination logic.
const calls = [];
const router = { push: (...args) => calls.push(['push', ...args]), replace: (...args) => calls.push(['replace', ...args]) };
const browserWindow = { history: { pushState: (...args) => calls.push(['pushState', ...args]), replaceState: (...args) => calls.push(['replaceState', ...args]) } };
function clickButton(file, label) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'button') {
      const text = node.children.filter(ts.isJsxText).map(child => child.text.trim()).join(' ');
      if (text === label) handler = node.openingElement.attributes.properties.find(prop => prop.name?.getText(ast) === 'onClick')?.initializer?.expression?.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(handler, `Missing actual callback for ${label}`);
  const js = ts.transpileModule(`const callback = ${handler}; callback();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('router', 'COMPANY_ROUTES', 'window', js)(router, COMPANY_ROUTES, browserWindow);
}
function linkDestination(file, label) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let href;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Link' && node.children.filter(ts.isJsxText).map(child => child.text.trim()).join(' ') === label) {
      href = node.openingElement.attributes.properties.find(prop => prop.name?.getText(ast) === 'href')?.initializer?.expression?.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(href, `Missing actual link for ${label}`);
  return new Function('COMPANY_ROUTES', `return ${href}`)(COMPANY_ROUTES);
}
assert.equal(linkDestination('app/company/onboarding/page.tsx', 'Gå till mitt konto'), '/profile?tab=settings');
assert.equal(linkDestination('app/company/onboarding/page.tsx', 'Fortsätt skapa min jobbannons'), '/company?view=skapa');
clickButton('app/company/page.tsx', 'Skapa din första annons');
assert.deepEqual(calls.pop(), ['pushState', null, '', '/company?view=skapa']);
const page = readFileSync('app/company/page.tsx', 'utf8');
assert.doesNotMatch(page, /setTab\(/, 'Company view may not have a second local source of truth');
assert.match(page, /const tab = companyView\(searchParams\.get\("view"\)/);
assert.match(page, /window\.history\.pushState\(null, "", item === "skapa" \? COMPANY_ROUTES\.create : COMPANY_ROUTES\.listings/);
const profile = readFileSync('app/profile/page.tsx', 'utf8');
assert.match(profile, /profileTabFromQuery\(query\.get\("tab"\)\)/);
assert.match(profile, /setProfileTab\(requestedProfileTab\); }, \[requestedProfileTab\]/);
const onboarding = readFileSync('app/company/onboarding/page.tsx', 'utf8');
assert.match(onboarding, /if \(step !== "profil"\) return;/);
assert.match(onboarding, /\[loading, user, profile, router, step\]/, 'Step transitions cancel stale initial profile reads');
const onboardingAst = ts.createSourceFile('onboarding.tsx', onboarding, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initialEffect;
const findEffect = node => {
  if (!initialEffect && ts.isCallExpression(node) && node.expression.getText(onboardingAst) === 'useEffect') initialEffect = node.arguments[0].getText(onboardingAst);
  ts.forEachChild(node, findEffect);
};
findEffect(onboardingAst);
const effectJs = ts.transpileModule(`const effect = ${initialEffect}; return effect();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let reads = 0, resolveRead;
const database = { from() { reads++; return this; }, select() { return this; }, eq() { return this; }, maybeSingle() { return new Promise(resolve => { resolveRead = resolve; }); } };
const noop = () => {};
const runEffect = (step, role = 'company') => new Function('loading', 'user', 'profile', 'router', 'step', 'getSupabaseClient', 'setCompanyName', 'setIndustry', 'setAdministrator', 'setOrganizationNumber', effectJs)(false, {id:'fictional-owner'}, {role}, router, step, () => database, noop, noop, noop, noop);
for (const step of ['val', 'matchprofil', 'annons']) assert.equal(runEffect(step), undefined);
assert.equal(reads, 0, 'Completed onboarding choices must not trigger an entry redirect');
const cleanup = runEffect('profil');
assert.equal(reads, 1);
cleanup(); // Saving the profile moves to the choice step and cleans up the old effect.
resolveRead({data:{company_name:'Fictional company',industry:'Test',administrator:'Test',organization_number:'0000000000'}});
await Promise.resolve();
assert.equal(calls.length, 0, 'Late profile reads may not redirect away from completion choices');
runEffect('profil');
resolveRead({data:{company_name:'Fictional company',industry:'Test',administrator:'Test',organization_number:'0000000000'}});
await Promise.resolve();
assert.deepEqual(calls.pop(), ['replace', '/company?view=swipe'], 'Returning completed accounts keep their existing entry redirect');
const nav = readFileSync('components/mobile-nav.tsx', 'utf8');
assert.match(nav, /profile\.role === "company" \? COMPANY_ROUTES\.account : "\/profile"/);
console.log('PASS company navigation: actual entry callbacks, URL-driven views, legacy aliases, query-driven account tab, preserved youth account destination.');
