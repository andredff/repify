import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SIZES   = [72, 96, 128, 144, 152, 192, 384, 512];
const SOURCE  = resolve('public/icon.png');
const OUT_DIR = resolve('public/icons');
const BG      = { r: 0x08, g: 0x0C, b: 0x10, alpha: 1 }; // #080C10

await mkdir(OUT_DIR, { recursive: true });

async function generate(size, fillRatio, suffix = '') {
  const inner = Math.round(size * fillRatio);
  const resized = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const file = resolve(OUT_DIR, `icon-${size}x${size}${suffix}.png`);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(file);

  console.log(`✓ ${file}`);
}

for (const size of SIZES) {
  // "any" — padding mínimo (icon ocupa 86% do quadrado)
  await generate(size, 0.86);
}

// Maskable 192/512 com safe zone (80% de fill)
await generate(192, 0.70, '-maskable');
await generate(512, 0.70, '-maskable');

// Apple touch icon — sem fundo do tema, fundo é o do app, usa o de 192 já gerado
console.log('\nDone.');
