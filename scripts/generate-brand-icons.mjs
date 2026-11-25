// Generates browser/iOS/web app sizes from the supplied MatchnWork artwork.
// Run after changing the mark: node scripts/generate-brand-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

// Keep the supplied PNG unchanged; derive only size/format/padding variants.
const source = 'public/brand/matchnwork-logo.png';
const original = (await import('node:fs/promises')).readFile;
const bytes = await original(source);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><image width="500" height="500" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>\n`;
const png = size => sharp(bytes).resize(size,size).png().toBuffer();

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

mkdirSync('public/icons', { recursive: true });
writeFileSync('app/icon.svg', svg);
writeFileSync('app/apple-icon.png', await sharp(bytes).resize(180,180).flatten({background:'#000000'}).png().toBuffer());
writeFileSync('app/favicon.ico', ico(await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(size) })))));
writeFileSync('public/icons/icon-192.png', await png(192));
writeFileSync('public/icons/icon-512.png', await png(512));
// Padding keeps all artwork within the maskable icon's circular safe zone.
writeFileSync('public/icons/maskable-512.png', await sharp(bytes).resize(400,400).flatten({background:'#000000'}).extend({top:56,bottom:56,left:56,right:56,background:'#000000'}).png().toBuffer());
console.log('Generated favicon, Apple and web app icons from supplied MatchnWork logo.');
