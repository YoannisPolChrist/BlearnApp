#!/usr/bin/env node
// Copy budget guard (Masterplan Phase D.2/D.4).
// Counts UI strings longer than MAX_LEN per component folder and fails when
// a folder exceeds its budget — so Erklärtext cannot creep back in.
// Usage: node scripts/copy-budget.mjs [--report]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_LEN = 80;

// Ratchet budgets: start at the measured 2026-06-12 baseline so the guard
// passes today and blocks any regression. Lower these as Phase D lands;
// final targets per docs Phase D.2 in comments.
const BUDGETS = {
  'src/components/modes': 82, // final target ≤ 10
  'src/components/settings': 62, // final target ≤ 10
  'src/components/wallet': 43, // final target ≤ 12
  'src/components/setup': 53, // final target ≤ 10
  'src/components/learn': 30, // final target ≤ 12
  'src/pages': 54, // final target ≤ 20
};

// SVG path data and similar non-copy strings start with drawing commands.
const NON_COPY_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz][\d\s.,-]/;
const STRING_PATTERN = /(["'`])((?:\\.|(?!\1).){80,}?)\1/g;

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\./.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLongStrings(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const hits = [];
  for (const match of source.matchAll(STRING_PATTERN)) {
    const value = match[2];
    if (value.length < MAX_LEN) continue;
    if (NON_COPY_PATTERN.test(value)) continue; // SVG path data
    if (/^https?:\/\//.test(value)) continue; // URLs
    if (/^[\w./@-]+$/.test(value)) continue; // import-ish identifiers
    hits.push(value.slice(0, 100));
  }
  return hits;
}

const report = process.argv.includes('--report');
let failed = false;

for (const [folder, budget] of Object.entries(BUDGETS)) {
  let files;
  try {
    files = collectFiles(folder);
  } catch {
    continue; // folder may not exist in some branches
  }

  let total = 0;
  const samples = [];
  for (const file of files) {
    const hits = countLongStrings(file);
    total += hits.length;
    if (report) {
      for (const hit of hits) samples.push(`    ${file}: "${hit}…"`);
    }
  }

  const status = total > budget ? 'ÜBER BUDGET' : 'ok';
  if (total > budget) failed = true;
  console.log(`${status.padEnd(12)} ${folder}: ${total} Strings > ${MAX_LEN} Zeichen (Budget: ${budget})`);
  if (report && samples.length > 0) {
    console.log(samples.slice(0, 10).join('\n'));
  }
}

if (failed) {
  console.error('\nCopy-Budget überschritten. Kürzen, in Progressive Disclosure verschieben');
  console.error('oder (nur bei bewusster Entscheidung) das Budget in scripts/copy-budget.mjs anpassen.');
  process.exit(1);
}

console.log('\nAlle Copy-Budgets eingehalten.');
