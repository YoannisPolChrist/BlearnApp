import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  join(process.cwd(), 'src/pages'),
  join(process.cwd(), 'src/components'),
  join(process.cwd(), 'src/lib/view-models'),
  join(process.cwd(), 'src/lib/i18n-packs'),
  join(process.cwd(), 'src/store'),
  join(process.cwd(), 'android/app/src/main/java'),
];

const FILE_PATTERN = /\.(ts|tsx|java)$/;
const MOJIBAKE_SEQUENCES = [
  '\u00C3',
  '\u00C2',
  '\u00E2\u20AC\u2122',
  '\u00E2\u20AC\u0153',
  '\u00E2\u20AC',
  '\uFFFD',
];
const MOJIBAKE_PATTERN = new RegExp(MOJIBAKE_SEQUENCES.join('|'), 'u');

function collectFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return collectFiles(fullPath);
    return FILE_PATTERN.test(fullPath) ? [fullPath] : [];
  });
}

describe('text hygiene', () => {
  it('contains no mojibake in user-facing source files', () => {
    const offenders = ROOTS
      .flatMap(collectFiles)
      .filter((filePath) => MOJIBAKE_PATTERN.test(readFileSync(filePath, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
