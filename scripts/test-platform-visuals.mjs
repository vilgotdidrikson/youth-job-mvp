import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync('components/ui/platform-visuals.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function('module', 'exports', 'require', code)(loaded, loaded.exports, require);
const visuals = Object.values(loaded.exports);
assert.equal(visuals.length, 5);

// PlatformShowcase renders every visual twice (desktop column and mobile list) in the same document.
const html = renderToStaticMarkup(React.createElement(React.Fragment, null, ...[0, 1].flatMap(copy => visuals.map((Visual, index) => React.createElement(Visual, { key: `${copy}-${index}` })))));
const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, 12, 'Six gradients per copy');
assert.equal(new Set(ids).size, ids.length, `Duplicate SVG ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
for (const id of ids) assert.match(id, /^[\w-]+$/, `Id ${id} is safe inside url(#…)`);
const refs = [...html.matchAll(/url\(#([^)]+)\)/g)].map(match => match[1]);
assert.ok(refs.length > 0);
for (const ref of refs) assert.ok(ids.includes(ref), `url(#${ref}) points at a gradient in the document`);
// Each copy references only its own gradients, so a hidden copy cannot blank the visible one.
const half = html.length / 2, firstCopy = html.slice(0, half), secondCopy = html.slice(half);
for (const [own, other] of [[firstCopy, secondCopy], [secondCopy, firstCopy]]) {
  const ownIds = [...own.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  for (const [, ref] of own.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ownIds.includes(ref) && !other.includes(`id="${ref}"`), `url(#${ref}) stays within its copy`);
}
console.log('PASS platform visuals: two copies of all five visuals have unique, URL-safe gradient ids and each copy only references its own.');
