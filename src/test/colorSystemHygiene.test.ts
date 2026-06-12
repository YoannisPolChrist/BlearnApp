import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');
const FILE_PATTERN = /\.(ts|tsx)$/;
const BLOCKED_COLOR_UTILS = /(emerald|amber|violet|yellow)-\d/;
const SELF_FILE = 'colorSystemHygiene.test.ts';

function collectFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return collectFiles(fullPath);
    return FILE_PATTERN.test(fullPath) ? [fullPath] : [];
  });
}

describe('color system hygiene', () => {
  it('contains no raw emerald/amber/violet/yellow utility classes in source files', () => {
    const offenders = collectFiles(ROOT).filter((filePath) => {
      if (filePath.endsWith(SELF_FILE)) return false;
      return BLOCKED_COLOR_UTILS.test(readFileSync(filePath, 'utf8'));
    });

    expect(offenders).toEqual([]);
  });
});
