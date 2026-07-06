// Bundle-Budget-Check: schlaegt fehl, wenn das gebaute Bundle die Budgets
// ueberschreitet. Laeuft gegen dist/ — vorher `npm run build` ausfuehren.
//
// Budgets bewusst mit Luft ueber dem Ist-Stand (2026-07: JS gesamt ~2,2 MB,
// groesster Chunk firebase-firestore ~397 kB), damit der Check Regressionen
// faengt statt bei jedem kleinen Feature zu nerven.
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DIST_ASSETS_DIR = path.resolve(process.cwd(), 'dist', 'assets');

const TOTAL_JS_BUDGET_BYTES = 2_800_000;
const TOTAL_CSS_BUDGET_BYTES = 400_000;
const LARGEST_CHUNK_BUDGET_BYTES = 450_000;

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function collectAssets() {
  let entries;
  try {
    entries = await readdir(DIST_ASSETS_DIR);
  } catch {
    console.error(`dist/assets nicht gefunden (${DIST_ASSETS_DIR}). Erst \`npm run build\` ausfuehren.`);
    process.exit(2);
  }

  const assets = [];
  for (const entry of entries) {
    const extension = path.extname(entry);
    if (extension !== '.js' && extension !== '.css') {
      continue;
    }
    const { size } = await stat(path.join(DIST_ASSETS_DIR, entry));
    assets.push({ name: entry, size, type: extension.slice(1) });
  }
  return assets;
}

const assets = await collectAssets();
const jsAssets = assets.filter((asset) => asset.type === 'js');
const cssAssets = assets.filter((asset) => asset.type === 'css');
const totalJs = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
const totalCss = cssAssets.reduce((sum, asset) => sum + asset.size, 0);
const largest = [...jsAssets].sort((a, b) => b.size - a.size)[0] ?? { name: '—', size: 0 };

console.log('Top-Chunks:');
for (const asset of [...jsAssets].sort((a, b) => b.size - a.size).slice(0, 8)) {
  console.log(`  ${formatKb(asset.size).padStart(10)}  ${asset.name}`);
}
console.log(`JS gesamt:  ${formatKb(totalJs)} (Budget ${formatKb(TOTAL_JS_BUDGET_BYTES)})`);
console.log(`CSS gesamt: ${formatKb(totalCss)} (Budget ${formatKb(TOTAL_CSS_BUDGET_BYTES)})`);

const violations = [];
if (totalJs > TOTAL_JS_BUDGET_BYTES) {
  violations.push(`JS gesamt ${formatKb(totalJs)} > Budget ${formatKb(TOTAL_JS_BUDGET_BYTES)}`);
}
if (totalCss > TOTAL_CSS_BUDGET_BYTES) {
  violations.push(`CSS gesamt ${formatKb(totalCss)} > Budget ${formatKb(TOTAL_CSS_BUDGET_BYTES)}`);
}
if (largest.size > LARGEST_CHUNK_BUDGET_BYTES) {
  violations.push(`Groesster Chunk ${largest.name} ${formatKb(largest.size)} > Budget ${formatKb(LARGEST_CHUNK_BUDGET_BYTES)}`);
}

if (violations.length > 0) {
  console.error(`\nBundle-Budget verletzt:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log('\nBundle-Budget eingehalten.');
