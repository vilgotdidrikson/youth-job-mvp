import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, name => imports[name] ?? require(name));
  return module.exports;
}

// Keyboard rules: wrap, skip disabled tabs, Home/End, ignore other keys.
const keys = compile('lib/tab-keyboard.ts');
const { tabIndexForKey } = keys;
const all = [true, true, true];
assert.equal(tabIndexForKey('ArrowRight', 0, all), 1);
assert.equal(tabIndexForKey('ArrowRight', 2, all), 0);
assert.equal(tabIndexForKey('ArrowLeft', 0, all), 2);
assert.equal(tabIndexForKey('Home', 2, all), 0);
assert.equal(tabIndexForKey('End', 0, all), 2);
assert.equal(tabIndexForKey('ArrowDown', 0, all), null, 'Horizontal tabs ignore vertical arrows');
assert.equal(tabIndexForKey('ArrowDown', 0, all, 'vertical'), 1);
assert.equal(tabIndexForKey('Enter', 0, all), null);
assert.equal(tabIndexForKey('ArrowRight', 0, [true, false, true]), 2, 'Disabled tabs are skipped');
assert.equal(tabIndexForKey('Home', 2, [false, true, true]), 1);
assert.equal(tabIndexForKey('End', 0, [true, true, false]), 1);
assert.equal(tabIndexForKey('ArrowRight', -1, all), 0, 'No selected tab starts from the first');
assert.equal(tabIndexForKey('ArrowLeft', -1, all), 2);
assert.equal(tabIndexForKey('ArrowRight', 0, [false, false]), null, 'All disabled gives no target');
assert.deepEqual(keys.tabPanelProps('profile', 'work'), { role: 'tabpanel', id: 'profile-panel', 'aria-labelledby': 'profile-tab-work' });

// The real TabList: one tab stop, selection state, panel link and key handling.
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...(Array.isArray(root) ? root : [root.props?.children]).flat(Infinity).flatMap(nodes)];
const focused = [];
const buttons = ['a', 'b', 'c'].map(value => ({ value, focus: () => focused.push(value) }));
const listRef = { current: { querySelectorAll: selector => { assert.equal(selector, '[role="tab"]'); return buttons; } } };
const { TabList } = compile('components/tab-list.tsx', { react: { useRef: () => listRef }, '@/lib/tab-keyboard': keys });
const changes = [];
const render = (value, disabled = {}) => TabList({ id: 'qa', label: 'QA-flikar', value, onChange: next => changes.push(next), items: ['a', 'b', 'c'].map(item => ({ value: item, label: item.toUpperCase(), disabled: disabled[item] })) });
let list = render('b');
assert.equal(list.props.role, 'tablist');
assert.equal(list.props['aria-label'], 'QA-flikar');
let tabs = nodes(list).filter(node => node.props?.role === 'tab');
assert.deepEqual(tabs.map(tab => tab.props['aria-selected']), [false, true, false]);
assert.deepEqual(tabs.map(tab => tab.props.tabIndex), [-1, 0, -1], 'Only the selected tab is in the tab order');
assert.deepEqual(tabs.map(tab => tab.props['aria-controls']), [undefined, 'qa-panel', undefined], 'Only the rendered panel is referenced');
assert.deepEqual(tabs.map(tab => tab.props.id), ['qa-tab-a', 'qa-tab-b', 'qa-tab-c']);
const press = key => { let prevented = false; list.props.onKeyDown({ key, preventDefault: () => { prevented = true; } }); return prevented; };
assert.equal(press('ArrowRight'), true);
assert.deepEqual([focused.pop(), changes.pop()], ['c', 'c'], 'Arrow keys move focus and select');
assert.equal(press('Home'), true);
assert.deepEqual([focused.pop(), changes.pop()], ['a', 'a']);
assert.equal(press('Tab'), false, 'Tab leaves the list untouched');
assert.equal(focused.length + changes.length, 0);
tabs[1].props.onClick();
assert.equal(changes.length, 0, 'Clicking the selected tab does not re-trigger navigation');
tabs[2].props.onClick();
assert.equal(changes.pop(), 'c');
list = render('missing');
tabs = nodes(list).filter(node => node.props?.role === 'tab');
assert.deepEqual(tabs.map(tab => tab.props.tabIndex), [0, -1, -1], 'An unmatched value keeps the list reachable');
list = render('a', { a: true });
tabs = nodes(list).filter(node => node.props?.role === 'tab');
assert.deepEqual(tabs.map(tab => tab.props.tabIndex), [-1, 0, -1], 'A disabled selected tab hands the tab stop to an enabled one');

// The real ModalDialog effect: focus returns to the opener when the dialog unmounts.
let effect;
const dialogElement = { open: false, showModal() { this.open = true; }, close() { this.open = false; }, contains: node => node === inside };
const { ModalDialog } = compile('components/modal-dialog.tsx', { react: { useRef: () => ({ current: dialogElement }), useEffect: fn => { effect = fn; } } });
class FakeElement { constructor(name) { this.name = name; this.isConnected = true; } focus() { document.activeElement = this; } }
const body = new FakeElement('body'), opener = new FakeElement('opener'), inside = new FakeElement('inside'), elsewhere = new FakeElement('elsewhere');
globalThis.HTMLElement = FakeElement;
globalThis.document = { body, activeElement: opener };
ModalDialog({ label: 'QA', onClose: () => {}, children: null });
let cleanup = effect();
assert.equal(dialogElement.open, true);
document.activeElement = body; // Unmounting removes the focused control inside the dialog.
cleanup();
assert.equal(document.activeElement, opener, 'Focus returns to the control that opened the dialog');
document.activeElement = opener; cleanup = effect(); document.activeElement = elsewhere; cleanup();
assert.equal(document.activeElement, elsewhere, 'A deliberate focus move by the caller is kept');
document.activeElement = opener; cleanup = effect(); opener.isConnected = false; document.activeElement = body; cleanup();
assert.equal(document.activeElement, body, 'A removed opener is not focused');
opener.isConnected = true; document.activeElement = body; cleanup = effect(); cleanup();
assert.equal(document.activeElement, body, 'Without a previous focus target nothing is forced');

// Every tab list on a page has a matching panel, and no tab bar still uses toggle semantics.
const tabPages = { 'app/profile/page.tsx': ['company-profile', 'profile'], 'app/applications/page.tsx': ['applications'], 'app/company/page.tsx': ['company-workspace', 'company-applications'], 'app/admin/recruitment/page.tsx': ['admin-recruitment'], 'app/video/record/page.tsx': ['video-mode'] };
for (const [file, ids] of Object.entries(tabPages)) {
  const source = readFileSync(file, 'utf8');
  for (const id of ids) {
    assert.match(source, new RegExp(`<TabList id="${id}"`), `${file} renders ${id} tabs`);
    assert.match(source, new RegExp(`tabPanelProps\\(["']${id}["']`), `${file} labels the ${id} panel`);
  }
}
for (const [file, oldMarkup] of [['app/profile/page.tsx', /aria-pressed=\{profileTab/], ['app/applications/page.tsx', /aria-pressed=\{tab ===/], ['app/company/page.tsx', /aria-pressed=\{(tab === item|candidateFilter)/], ['app/admin/recruitment/page.tsx', /aria-pressed=\{filter/], ['app/video/record/page.tsx', /aria-pressed=\{mode/]]) {
  assert.doesNotMatch(readFileSync(file, 'utf8'), oldMarkup, `${file} no longer marks tabs as toggle buttons`);
}
for (const [file, selector] of [['app/profile/profile.css', '.company-profile-tabs button[aria-selected="true"]'], ['app/profile/profile.css', '.mnw-profile-tabs [aria-selected="true"]'], ['app/applications/applications-design.css', '.applications-tabs button[aria-selected="true"]'], ['app/company/company-design.css', '.company-workspace-tabs button[aria-selected="true"]'], ['app/company/company-design.css', '.company-application-tabs button[aria-selected="true"]'], ['components/video.module.css', '.modeTabs button[aria-selected=true]'], ['components/recruitment.module.css', '.filterTabs [aria-selected=true]']]) {
  assert.ok(readFileSync(file, 'utf8').includes(selector), `${file} styles the selected tab via ${selector}`);
}

// Single role choice: native radios in a named fieldset.
const auth = readFileSync('components/auth-page.tsx', 'utf8');
assert.match(auth, /<fieldset className="auth-role"><legend>Jag är\.\.\.<\/legend>/);
assert.match(auth, /<input type="radio" name="role" value=\{value\} checked=\{role === value\} onChange=\{\(\) => setRole\(value\)\} \/>/);
assert.doesNotMatch(auth, /aria-pressed=\{role ===/);
const authCss = readFileSync('app/globals.css', 'utf8');
assert.match(authCss, /\.auth-role label:has\(input:focus-visible\)/, 'The visible role card shows keyboard focus');
assert.match(authCss, /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible/, 'A baseline focus ring exists for every surface');

// View switches and multi-select chips are named groups of toggle buttons.
assert.match(readFileSync('app/kartan/page.tsx', 'utf8'), /className="mnw-map-switch" role="group" aria-label="Kartans vy"/);
assert.match(readFileSync('components/job-preview-dialog.tsx', 'utf8'), /className="job-preview-switch" role="group" aria-label="Välj förhandsvisning"/);
const company = readFileSync('app/company/page.tsx', 'utf8');
for (const id of ['job-employment-type-label', 'job-requirements-label', 'job-traits-label', 'job-benefits-label']) {
  assert.match(company, new RegExp(`id="${id}"`)); assert.match(company, new RegExp(`role="group" aria-labelledby="${id}"`));
}
assert.doesNotMatch(company, /<label className="job-builder-label"[^>]*>Anställningsform/, 'No orphan label without a control');
assert.match(readFileSync('components/recruitment-profile-editor.tsx', 'utf8'), /className=\{styles\.chips\} role="group" aria-label=\{groupLabel\}/);
assert.match(readFileSync('components/youth-cv-hub.tsx', 'utf8'), /className="cv-hub-chips" role="group" aria-label=\{label\}/);
assert.equal((readFileSync('components/company-match-profile-form.tsx', 'utf8').match(/className="company-match-chips" role="group" aria-label=/g) ?? []).length, 2);

console.log('PASS accessibility: tab keys/skip/wrap, actual TabList stop/selection/panel link, actual ModalDialog focus return, tab panels on all pages, role radios, named chip and view groups, focus baseline.');
