#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires -- standalone CommonJS build script (run via `node scripts/generate-icons.js`) */
/**
 * PWA icon generator (Session 16b, Block 3).
 *
 * Produces every size referenced by apps/web/public/manifest.json from a single
 * source image. If `scripts/assets/logo-source-1024.png` exists it is used as the
 * artwork; otherwise a branded placeholder (theme-colour tile + "NG" monogram) is
 * generated so the manifest never 404s and Lighthouse PWA checks pass. Replace the
 * source file with the real 1024×1024 logo before launch and re-run.
 *
 *   node scripts/generate-icons.js
 *
 * Maskable icons (192/512) keep the artwork inside the inner ~80% safe zone by
 * sizing the monogram conservatively and bleeding the background to the edges.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(__dirname, 'assets', 'logo-source-1024.png');
const OUT_DIR = path.join(ROOT, 'apps', 'web', 'public', 'icons');

const THEME = '#3b82f6';
const BACKGROUND = '#0a0a0a';
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

/** A 1024×1024 branded placeholder used when no real logo is supplied. */
function placeholderSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
       <rect width="1024" height="1024" fill="${BACKGROUND}"/>
       <rect x="112" y="112" width="800" height="800" rx="160" fill="${THEME}"/>
       <text x="512" y="512" font-family="Arial, Helvetica, sans-serif" font-size="380"
             font-weight="700" fill="#ffffff" text-anchor="middle"
             dominant-baseline="central">NG</text>
     </svg>`,
  );
}

async function loadSource() {
  if (fs.existsSync(SOURCE)) {
    console.log(`Using logo source: ${path.relative(ROOT, SOURCE)}`);
    return sharp(SOURCE).resize(1024, 1024, { fit: 'cover' });
  }
  console.log('No logo-source-1024.png found — generating branded placeholder.');
  return sharp(placeholderSvg());
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceBuffer = await (await loadSource()).png().toBuffer();

  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(sourceBuffer).resize(size, size, { fit: 'cover' }).png().toFile(out);
    console.log(`  ✓ icon-${size}.png`);
  }

  // Apple touch icon (iOS home-screen) — opaque background, no transparency.
  await sharp(sourceBuffer)
    .resize(180, 180, { fit: 'cover' })
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png');

  // Shortcut icon ("Neuer Deal") — distinct accent tile with a "+".
  const shortcutSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
       <rect width="96" height="96" rx="20" fill="${THEME}"/>
       <path d="M48 26 V70 M26 48 H70" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
     </svg>`,
  );
  await sharp(shortcutSvg).png().toFile(path.join(OUT_DIR, 'shortcut-deal.png'));
  console.log('  ✓ shortcut-deal.png');

  console.log(`\nDone — ${SIZES.length + 2} icons written to ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
