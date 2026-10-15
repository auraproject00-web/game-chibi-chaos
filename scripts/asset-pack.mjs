// Checks the premium Candy Meadow images and writes public/assets/candy-meadow/pack.json.
// Usage: npm run assets:pack   (add --strict to fail on size or transparency mismatches)
// Only files named in src/art/premium/candyMeadowAssets.json are listed; anything missing keeps
// its procedural placeholder in the game.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'src/art/premium/candyMeadowAssets.json'), 'utf8'));
const folder = join(root, 'public', manifest.folder);
const strict = process.argv.includes('--strict');

/** Width, height and whether the image can hold transparency, read from the file header. */
function probe(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) {
    const colorType = buf[25];
    const hasTrns = buf.includes(Buffer.from('tRNS'));
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 || hasTrns };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), alpha: (buf[20] & 0x10) !== 0 };
    }
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, alpha: ((b >> 28) & 1) === 1 };
    }
    if (chunk === 'VP8 ') {
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
    }
  }
  return null;
}

const files = [];
const problems = [];
const missing = [];
for (const a of manifest.assets) {
  const ext = ['.webp', '.png'].find((e) => existsSync(join(folder, a.file + e)));
  if (!ext) {
    missing.push(`${a.file}.png|.webp`);
    continue;
  }
  const info = probe(readFileSync(join(folder, a.file + ext)));
  const name = a.file + ext;
  if (!info) {
    problems.push(`${name}: not a PNG or WebP file, skipped`);
    continue;
  }
  const [w, h] = a.size;
  if (info.w !== w || info.h !== h) problems.push(`${name}: ${info.w}x${info.h}, expected ${w}x${h}`);
  if (a.alpha && !info.alpha) problems.push(`${name}: needs transparency (alpha channel)`);
  files.push({ type: 'image', key: `cm_${a.id}`, url: manifest.folder + name });
}

writeFileSync(join(folder, 'pack.json'), JSON.stringify({ candyMeadow: { files } }, null, 2) + '\n');
console.log(`pack.json: ${files.length}/${manifest.assets.length} premium images listed, ${missing.length} still placeholders`);
for (const p of problems) console.log(`  ! ${p}`);
if (missing.length) console.log(`  placeholders: ${missing.join(', ')}`);
if (strict && problems.length) process.exit(1);
