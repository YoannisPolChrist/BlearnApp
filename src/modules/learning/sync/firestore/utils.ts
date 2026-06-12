import type { LearningCloudState } from '@/lib/learningCloudSync';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => sanitizeFirestoreValue(entry)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => (
      entry === undefined
        ? []
        : [[key, sanitizeFirestoreValue(entry)]]
    )),
  ) as T;
}

export function getApproximateFirestorePayloadBytes(value: unknown) {
  const serializedValue = JSON.stringify(value);
  if (!serializedValue) {
    return 0;
  }

  return new TextEncoder().encode(serializedValue).length;
}

export function getLearningCloudEntityCount(state: LearningCloudState | null | undefined) {
  if (!state) {
    return 0;
  }

  return (
    Object.keys(state.decks).length
    + Object.keys(state.notes).length
    + Object.keys(state.cards).length
    + Object.keys(state.reviewLogs).length
    + Object.keys(state.presets).length
  );
}

export function toCanonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalJsonValue(entry));
  }

  if (!isPlainObject(value)) {
    return value ?? null;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .flatMap((key) => {
        const normalizedValue = toCanonicalJsonValue((value as Record<string, unknown>)[key]);
        return normalizedValue == null ? [] : [[key, normalizedValue]];
      }),
  );
}

export function stableStringify(value: unknown) {
  return JSON.stringify(toCanonicalJsonValue(value));
}

export async function runWithConcurrencyLimit(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
) {
  if (tasks.length === 0) {
    return;
  }

  let nextTaskIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), tasks.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      const task = tasks[taskIndex];
      if (!task) {
        return;
      }

      await task();
    }
  }));
}
