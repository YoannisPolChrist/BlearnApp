import { createSyncCursor, type MutationLogState, type SyncCursor, type SyncMutationEntry, type SyncMutationInput } from './syncTypes';

function compareEntries(left: SyncMutationEntry, right: SyncMutationEntry): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }

  return left.mutationId.localeCompare(right.mutationId);
}

function compareCursor(left: SyncCursor, right: SyncCursor): number {
  if (left.clientId !== right.clientId) {
    return left.clientId.localeCompare(right.clientId);
  }

  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.updatedAt - right.updatedAt;
}

function isNewerCursor(left: SyncCursor | null, right: SyncCursor | null): boolean {
  if (!left) return Boolean(right);
  if (!right) return false;
  return compareCursor(right, left) > 0;
}

function generateMutationId(
  clientId: string,
  sequence: number,
  entityType: string,
  entityId: string,
  kind: string,
  createdAt: number,
): string {
  return [clientId, sequence, entityType, entityId, kind, createdAt].join(':');
}

export function createMutationLog(
  clientId: string,
  entries: SyncMutationEntry[] = [],
  acknowledgedCursor: SyncCursor | null = null,
): MutationLogState {
  const normalizedEntries = [...entries].sort(compareEntries);
  const dedupedEntries: SyncMutationEntry[] = [];
  const seenMutationIds = new Set<string>();

  for (const entry of normalizedEntries) {
    if (seenMutationIds.has(entry.mutationId)) {
      continue;
    }

    seenMutationIds.add(entry.mutationId);
    dedupedEntries.push(entry);
  }

  const lastSequence = dedupedEntries.reduce(
    (max, entry) => Math.max(max, entry.sequence),
    acknowledgedCursor?.sequence ?? 0,
  );

  return {
    clientId,
    lastSequence,
    acknowledgedCursor,
    entries: dedupedEntries,
  };
}

export function normalizeMutationLog(
  log?: Partial<MutationLogState> | null,
): MutationLogState {
  return createMutationLog(
    log?.clientId || 'local',
    Array.isArray(log?.entries) ? log.entries : [],
    log?.acknowledgedCursor ?? null,
  );
}

export function hasAppliedMutation(log: MutationLogState, mutationId: string): boolean {
  return log.entries.some((entry) => entry.mutationId === mutationId);
}

export function appendMutation(
  log: MutationLogState,
  mutation: SyncMutationInput,
  now = Date.now(),
): {
  log: MutationLogState;
  mutation: SyncMutationEntry;
} {
  const createdAt = Math.max(0, Math.round(mutation.createdAt ?? now));
  const nextSequence = log.lastSequence + 1;
  const mutationEntry: SyncMutationEntry = {
    mutationId:
      mutation.mutationId
      ?? generateMutationId(log.clientId, nextSequence, mutation.entityType, mutation.entityId, mutation.kind, createdAt),
    clientId: log.clientId,
    sequence: nextSequence,
    createdAt,
    entityType: mutation.entityType,
    entityId: mutation.entityId,
    kind: mutation.kind,
    baseRevision: mutation.baseRevision,
    payload: mutation.payload as SyncMutationEntry['payload'],
  };

  if (hasAppliedMutation(log, mutationEntry.mutationId)) {
    return {
      log,
      mutation: log.entries.find((entry) => entry.mutationId === mutationEntry.mutationId) ?? mutationEntry,
    };
  }

  return {
    log: {
      ...log,
      lastSequence: nextSequence,
      entries: [...log.entries, mutationEntry].sort(compareEntries),
    },
    mutation: mutationEntry,
  };
}

export function getMutationLogCursor(log: MutationLogState): SyncCursor | null {
  const latestEntry = [...log.entries].sort(compareEntries).at(-1);
  if (!latestEntry) {
    return log.acknowledgedCursor;
  }

  return createSyncCursor(log.clientId, latestEntry.sequence, latestEntry.createdAt);
}

export function getMutationsSinceCursor(
  log: MutationLogState,
  cursor: SyncCursor | null | undefined,
): SyncMutationEntry[] {
  if (!cursor || cursor.clientId !== log.clientId) {
    return [...log.entries].sort(compareEntries);
  }

  return [...log.entries]
    .filter((entry) => entry.sequence > cursor.sequence)
    .sort(compareEntries);
}

export function acknowledgeMutationLog(
  log: MutationLogState,
  cursor: SyncCursor | null | undefined,
): MutationLogState {
  if (!cursor) {
    return log;
  }

  const currentCursor = log.acknowledgedCursor;
  if (!isNewerCursor(currentCursor, cursor)) {
    return log;
  }

  return {
    ...log,
    acknowledgedCursor: cursor,
    entries: log.entries.filter((entry) => {
      if (entry.clientId !== cursor.clientId) {
        return true;
      }

      return entry.sequence > cursor.sequence;
    }),
  };
}

export function getPendingMutations(
  log: MutationLogState,
  cursor: SyncCursor | null | undefined = log.acknowledgedCursor,
): SyncMutationEntry[] {
  return getMutationsSinceCursor(log, cursor);
}

export function advanceMutationCursor(
  log: MutationLogState,
  cursor: SyncCursor | null | undefined,
): MutationLogState {
  return acknowledgeMutationLog(log, cursor);
}
