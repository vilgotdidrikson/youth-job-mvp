// Design-token check (DA-04/DA-05): colour literals outside app/styles/theme.css and the number of distinct
// font sizes, radii and weights may not grow. Values that are only a theme token (var(--…)) are the DA-05 scale
// and are not counted; neither are @font-face descriptors. Run with --update to lower the baseline after a migration.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = 'scripts/design-token-baseline.json';
const files = [];
const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (path.endsWith('.css') && !path.endsWith('styles/theme.css')) files.push(path); } };
['app', 'components'].forEach(walk);

const hexPerFile = {}, sizes = new Set(), radii = new Set(), weights = new Set();
for (const file of files.sort()) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*{[^}]*}/g, '');
  const literal = value => !/^var\(--[\w-]+\)$/.test(value.trim());
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  if (hex.length) hexPerFile[file] = hex.length;
  for (const [, value] of css.matchAll(/font-size\s*:\s*([^;}!]+)/g)) if (literal(value)) sizes.add(value.trim());
  for (const [, value] of css.matchAll(/border-radius\s*:\s*([^;}!]+)/g)) if (literal(value)) radii.add(value.trim());
  for (const [, value] of css.matchAll(/font-weight\s*:\s*([^;}!]+)/g)) if (literal(value)) weights.add(value.trim());
}
const current = { hex: Object.values(hexPerFile).reduce((a, b) => a + b, 0), fontSizes: sizes.size, radii: radii.size, fontWeights: weights.size };

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify({ ...current, hexPerFile }, null, 2) + '\n');
  console.log('Baseline updated:', current);
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const grown = Object.keys(current).filter(key => current[key] > baseline[key]);
const files_grown = Object.entries(hexPerFile).filter(([file, count]) => count > (baseline.hexPerFile?.[file] ?? 0));
if (grown.length || files_grown.length) {
  console.error('FAIL design tokens: use var(--…) from app/styles/theme.css and the DA-05 scale instead of new values.');
  for (const key of grown) console.error(`  ${key}: ${baseline[key]} → ${current[key]}`);
  for (const [file, count] of files_grown) console.error(`  ${file}: ${baseline.hexPerFile?.[file] ?? 0} → ${count} colour literals`);
  process.exit(1);
}
console.log(`PASS design tokens: ${current.hex} colour literals (baseline ${baseline.hex}), ${current.fontSizes} font sizes, ${current.radii} radii, ${current.fontWeights} weights.`);
