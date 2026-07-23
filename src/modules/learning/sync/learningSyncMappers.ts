import type { LearningCard, LearningDeck, LearningNote, LearningPreset, ReviewLog } from '@/lib/learning';

export function normalizeRevisionTimestamp(value: number | undefined): number {
  return Number.isFinite(value) && (value || 0) > 0
    ? Math.round(value as number)
    : 0;
}

export function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeLearningNote(note: LearningNote): LearningNote {
  const createdAt = Number.isFinite(note.createdAt) ? note.createdAt : Date.now();
  const updatedAt = Number.isFinite(note.updatedAt)
    ? Math.max(note.updatedAt as number, createdAt)
    : createdAt;

  return {
    ...note,
    type: note.type === 'cloze' ? 'cloze' : 'basic',
    front: note.front || '',
    back: note.back || '',
    frontHtml: note.frontHtml || undefined,
    backHtml: note.backHtml || undefined,
    tags: Array.isArray(note.tags) ? Array.from(new Set(note.tags.filter(Boolean))) : [],
    language: note.language || 'de',
    templateCss: note.templateCss || undefined,
    templateCardClass: note.templateCardClass || undefined,
    createdAt,
    updatedAt,
  };
}

export function getDeckRevision(deck: LearningDeck): number {
  return Math.max(deck.updatedAt || 0, deck.createdAt || 0);
}

export function getNoteRevision(note: LearningNote): number {
  return Math.max(note.updatedAt || 0, note.createdAt || 0);
}

export function getCardRevision(card: LearningCard): number {
  return Math.max(
    card.updatedAt || 0,
    card.lastReviewedAt || 0,
    card.dueAt || 0,
    card.createdAt || 0,
  );
}

/**
 * Card scheduling is not ordinary document metadata: a template refresh or a
 * stale device can legitimately get a fresh `updatedAt` without containing
 * the user's latest review.  Use the actual review event as the primary
 * causal marker so such a document can never roll a reviewed card back.
 */
export function mergeCardsById(
  localCards: LearningCard[],
  remoteCards: LearningCard[],
): LearningCard[] {
  const merged = new Map<string, LearningCard>();

  for (const card of localCards) {
    merged.set(card.id, card);
  }

  for (const incoming of remoteCards) {
    const existing = merged.get(incoming.id);
    if (!existing) {
      merged.set(incoming.id, incoming);
      continue;
    }

    const existingReviewedAt = normalizeRevisionTimestamp(existing.lastReviewedAt);
    const incomingReviewedAt = normalizeRevisionTimestamp(incoming.lastReviewedAt);

    if (incomingReviewedAt !== existingReviewedAt) {
      merged.set(incoming.id, incomingReviewedAt > existingReviewedAt ? incoming : existing);
      continue;
    }

    // Equal review timestamps can occur when two snapshots contain the same
    // review.  Keep the state with at least as much accumulated progress;
    // only use normal document metadata before either side was reviewed.
    if (existingReviewedAt > 0) {
      if (incoming.reps !== existing.reps) {
        merged.set(incoming.id, incoming.reps > existing.reps ? incoming : existing);
      } else if (incoming.lapses !== existing.lapses) {
        merged.set(incoming.id, incoming.lapses > existing.lapses ? incoming : existing);
      }
      continue;
    }

    merged.set(
      incoming.id,
      getCardRevision(incoming) > getCardRevision(existing) ? incoming : existing,
    );
  }

  return Array.from(merged.values());
}

export function getReviewLogRevision(log: ReviewLog): number {
  return log.reviewedAt || 0;
}

export function getPresetRevision(preset: LearningPreset): number {
  return Math.max(
    preset.updatedAt || 0,
    preset.lastOptimizerRunAt || 0,
    preset.lastOptimizerReviewCount || 0,
  );
}

export function mergeById<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  getRevision: (item: T) => number,
): T[] {
  const merged = new Map<string, T>();

  for (const item of localItems) {
    merged.set(item.id, item);
  }

  for (const item of remoteItems) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    const existingRevision = getRevision(existing);
    const incomingRevision = getRevision(item);
    merged.set(item.id, incomingRevision > existingRevision ? item : existing);
  }

  return Array.from(merged.values());
}

function normalizeActiveDeckId(
  activeDeckId: string | undefined,
  decks: LearningDeck[],
): string | undefined {
  if (activeDeckId && decks.some((deck) => deck.id === activeDeckId)) {
    return activeDeckId;
  }

  return decks[0]?.id;
}

export function normalizeActiveDeckSelection(
  activeDeckId: string | undefined,
  activeDeckUpdatedAt: number | undefined,
  decks: LearningDeck[],
) {
  const normalizedActiveDeckId = normalizeActiveDeckId(activeDeckId, decks);
  if (!normalizedActiveDeckId) {
    return {
      activeDeckId: undefined,
      activeDeckUpdatedAt: undefined,
    };
  }

  const selectedDeck = decks.find((deck) => deck.id === normalizedActiveDeckId);
  const fallbackTimestamp = selectedDeck ? getDeckRevision(selectedDeck) : 0;
  const normalizedActiveDeckUpdatedAt = Math.max(
    normalizeRevisionTimestamp(activeDeckUpdatedAt),
    fallbackTimestamp,
  );

  return {
    activeDeckId: normalizedActiveDeckId,
    activeDeckUpdatedAt: normalizedActiveDeckUpdatedAt || undefined,
  };
}

export function pickMostRecentActiveDeckSelection(
  localSelection: Pick<{ activeDeckId?: string; activeDeckUpdatedAt?: number }, 'activeDeckId' | 'activeDeckUpdatedAt'>,
  remoteSelection: Pick<{ activeDeckId?: string; activeDeckUpdatedAt?: number }, 'activeDeckId' | 'activeDeckUpdatedAt'>,
) {
  if (!localSelection.activeDeckId) {
    return remoteSelection;
  }

  if (!remoteSelection.activeDeckId) {
    return localSelection;
  }

  const localRevision = normalizeRevisionTimestamp(localSelection.activeDeckUpdatedAt);
  const remoteRevision = normalizeRevisionTimestamp(remoteSelection.activeDeckUpdatedAt);

  return remoteRevision > localRevision ? remoteSelection : localSelection;
}
