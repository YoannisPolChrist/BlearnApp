import type { ImportableRow, LearningCard } from '../domain/entities';

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  }

  return Array.from(new Set(tags.split('|').map((tag) => tag.trim()).filter(Boolean)));
}

export function isRowEmpty(row: Pick<ImportableRow, 'front' | 'clozeText'>): boolean {
  return !row.front.trim() && !row.clozeText?.trim();
}

export function mergeCardMetadata(
  base: Partial<LearningCard> | undefined,
  fallbackCreatedAt: number,
  fallbackDueAt: number,
) {
  return {
    state: base?.state || 'new',
    dueAt: base?.dueAt ?? fallbackDueAt,
    intervalDays: Math.max(0, Math.round(base?.intervalDays ?? base?.scheduledDays ?? 0)),
    easeFactor: base?.easeFactor ?? 2.5,
    reps: Math.max(0, Math.round(base?.reps || 0)),
    lapses: Math.max(0, Math.round(base?.lapses || 0)),
    stepIndex: Math.max(0, Math.round(base?.stepIndex || 0)),
    scheduledDays: Math.max(0, Math.round(base?.scheduledDays ?? base?.intervalDays ?? 0)),
    elapsedDays: Math.max(0, Math.round(base?.elapsedDays || 0)),
    memoryState: base?.memoryState || null,
    lastReviewedAt: base?.lastReviewedAt,
    createdAt: base?.createdAt ?? fallbackCreatedAt,
  } satisfies Partial<LearningCard>;
}
