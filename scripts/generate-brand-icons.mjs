// Generates the MatchnWork M mark in every size the browser, iOS and the web manifest ask for.
// Run after changing the mark: node scripts/generate-brand-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BRAND = '#b84164'; // --color-brand in app/styles/theme.css
const M = '<path d="M150 360V160l106 128 106-128v200" fill="none" stroke="#fff" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>';

/** rounded: the landing logo shape (tight bottom-left corner). Otherwise full-bleed for iOS and maskable icons, which apply their own mask. */
export function markSvg({ rounded }) {
  const background = rounded
    ? `<path d="M164 0h184a164 164 0 0 1 164 164v184a164 164 0 0 1-164 164H34A34 34 0 0 1 0 478V164A164 164 0 0 1 164 0Z" fill="${BRAND}"/>`
    : `<rect width="512" height="512" fill="${BRAND}"/>`;
  // Full-bleed icons keep the mark inside the 80% maskable safe zone.
  const mark = rounded ? M : `<g transform="translate(64 64) scale(.75)">${M}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background}${mark}</svg>\n`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

/** An .ico that embeds PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(image => image.data)]);
}

const rounded = markSvg({ rounded: true }), fullBleed = markSvg({ rounded: false });
mkdirSync('public/icons', { recursive: true });
writeFileSync('app/icon.svg', rounded);
writeFileSync('app/apple-icon.png', await png(fullBleed, 180));
writeFileSync('app/favicon.ico', ico(await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(rounded, size) })))));
writeFileSync('public/icons/icon-192.png', await png(rounded, 192));
writeFileSync('public/icons/icon-512.png', await png(rounded, 512));
writeFileSync('public/icons/maskable-512.png', await png(fullBleed, 512));
console.log('Wrote app/icon.svg, app/apple-icon.png, app/favicon.ico and public/icons/{icon-192,icon-512,maskable-512}.png');
