import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const css=readFileSync('app/fonts.css','utf8');
const layout=readFileSync('app/layout.tsx','utf8');
const manifest=JSON.parse(readFileSync('public/fonts/manifest.json','utf8'));
assert.equal(manifest.length,10,'Preserve every previously shipped font subset');
assert.ok(!layout.includes('next/font/google'),'Build must not depend on Google font discovery');
assert.ok(layout.includes('import "./fonts.css"'));
const faces=css.match(/@font-face\{[^}]+\}/g);
assert.equal(faces.length,18,'Preserve Inter variable faces, Fraunces 500/600/700 and both metric fallbacks');
for(const entry of manifest){
 const bytes=readFileSync('public/fonts/'+entry.file);
 assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(bytes.readUInt32BE(8),bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,'Font bytes remain identical to the successful build');
 const matched=faces.filter(face=>face.includes(`/fonts/${entry.file}`));
 assert.ok(matched.length);for(const face of matched){assert.ok(face.includes(`font-family:${entry.family};`));assert.ok(face.includes(`unicode-range:${entry.unicodeRange}`));assert.ok(face.includes('font-display:swap'));}
}
for(const family of ['inter','fraunces']){
 assert.ok(layout.includes(`href="/fonts/${family}-latin.woff2"`),'Preserve Latin preload');
 assert.ok(readFileSync(`public/fonts/${family}-OFL.txt`,'utf8').includes('SIL OPEN FONT LICENSE'));
}
assert.ok(css.includes('ascent-override:90.44%'));assert.ok(css.includes('size-adjust:107.12%'));
assert.ok(css.includes('ascent-override:84.71%'));assert.ok(css.includes('size-adjust:115.45%'));
assert.ok(css.includes('--font-inter: "Inter", "Inter Fallback"'));assert.ok(css.includes('--font-fraunces: "Fraunces", "Fraunces Fallback"'));
assert.ok(!css.includes('https:')&&!css.includes('/_next/static/'));
console.log('PASS: exact font bytes, WOFF2 headers/lengths, all unicode subsets, weights, fallback metrics, Latin preloads, existing variables and bundled licenses.');
