#!/usr/bin/env node
/**
 * Produce a single, self-contained dist/sketchly.html.
 * Bundles all src/*.js modules into one inline <script> (stripping ES
 * import/export lines — modules are concatenated in dependency order)
 * and inlines src/styles.css into a <style> block. Runs offline via file://.
 *   npm run build
 * @module build
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const MODULE_ORDER = [
  'geometry.js',
  'scene.js',
  'render.js',
  'theme.js',
  'store.js',
  'app.js',
];

async function main() {
  const css = await readFile(path.join(SRC, 'styles.css'), 'utf8');

  const files = await readdir(SRC);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const ordered = [
    ...MODULE_ORDER.filter((m) => jsFiles.includes(m)),
    ...jsFiles.filter((f) => !MODULE_ORDER.includes(f)).sort(),
  ];

  let bundle = '';
  for (const f of ordered) {
    let code = await readFile(path.join(SRC, f), 'utf8');
    code = code
      .replace(/^\s*import[^\n]*\n/gm, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
    bundle += `\n/* ===== ${f} ===== */\n` + code;
  }

  if (bundle.match(/^\s*(import|export)\s/gm)) {
    console.warn('WARNING: possible leftover import/export in bundle');
  }

  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const inlined = html
    .replace(/<link[^>]*href="src\/styles\.css"[^>]*>/, `<style>\n${css}\n</style>`)
    .replace(/<script[^>]*src="src\/app\.js"[^>]*>\s*<\/script>/, `<script>\n${bundle}\n</script>`);

  await mkdir(DIST, { recursive: true });
  const outPath = path.join(DIST, 'sketchly.html');
  await writeFile(outPath, inlined, 'utf8');

  const kb = (Buffer.byteLength(inlined, 'utf8') / 1024).toFixed(1);
  console.log(`Built ${outPath} (${kb} KB)`);
  console.log('Open it directly in a browser — no server needed.');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
