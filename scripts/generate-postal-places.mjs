// Builds lib/server/postal-places-se.json from the GeoNames postal code file for Sweden.
// Source: https://download.geonames.org/export/zip/SE.zip (GeoNames, CC BY 4.0, www.geonames.org).
// Usage: node scripts/generate-postal-places.mjs <path to SE.txt>
import { readFileSync, writeFileSync } from 'node:fs';
const input = process.argv[2];
if (!input) throw new Error('Path to SE.txt required');
const km = (a, b) => { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) * r / 2), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; };
const rows = readFileSync(input, 'utf8').trim().split(/\r?\n/).map(line => line.split('\t'))
  .map(r => ({ code: Number(r[1].replace(/\s/g, '')), name: r[2].trim(), point: [Number(Number(r[9]).toFixed(3)), Number(Number(r[10]).toFixed(3))] }))
  .filter(r => Number.isInteger(r.code) && r.code >= 10000 && r.code <= 99999 && r.name && Number.isFinite(r.point[0]) && Number.isFinite(r.point[1]))
  .sort((a, b) => a.code - b.code);
const places = [], index = new Map();
const place = r => { const key = r.point.join(','); if (!index.has(key)) { index.set(key, places.length); places.push(r.point); } return index.get(key); };
// Neighbouring codes of the same postal town become one range; a code outside every range is unknown.
const ranges = [];
for (const r of rows) { const p = place(r), last = ranges.at(-1); if (last && last[2] === p) last[1] = r.code; else ranges.push([r.code, r.code, p]); }
// A town name is usable only when all its points lie within 10 km of each other; otherwise it is ambiguous and stays unknown.
const byName = new Map();
for (const r of rows) { const key = r.name.toLocaleLowerCase('sv-SE'); if (!byName.has(key)) byName.set(key, new Set()); byName.get(key).add(place(r)); }
const names = {};
for (const [name, set] of [...byName].sort((a, b) => a[0].localeCompare(b[0], 'sv-SE'))) { const list = [...set]; if (list.every(p => km(places[list[0]], places[p]) <= 10)) names[name] = list[0]; }
writeFileSync('lib/server/postal-places-se.json', JSON.stringify({ source: 'GeoNames postal codes SE, CC BY 4.0, www.geonames.org', precision: 'postal town', places, ranges, names }) + '\n');
console.log({ codes: rows.length, places: places.length, ranges: ranges.length, names: Object.keys(names).length, ambiguousNames: byName.size - Object.keys(names).length });
