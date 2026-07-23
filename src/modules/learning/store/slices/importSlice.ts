import type { StateCreator } from 'zustand';
import {
  buildDeckExportPayload,
  buildEntitiesFromRows,
  getFeaturedDeckTemplates,
  getStarterDeckRows,
  migrateLearningDeck,
  migrateLearningCard,
  migrateReviewLog,
  normalizeImportPayload,
  parseCsv,
  type LearningCard,
  type ReviewLog,
} from '@/lib/learning';
import { appendLearningCloudTombstones } from '@/lib/learningCloudLocalSyncState';
import type { LearningImportSlice, LearningManualCardInput, LearningStore } from '../types';
import {
  applyLearningStoreIndexes,
  appendLearningImportJob,
  createLearningImportJob,
  createLearningMediaStoreState,
  createIndexedRecordView,
  mergeLearningImportedEntities,
  registerLearningMediaArtifacts,
} from '../helpers';
import { buildFeaturedTemplateEntities } from '../../workers/templateImportWorker';

function remapImportedDeckIds(
  entities: {
    decks: ReturnType<typeof buildEntitiesFromRows>['decks'];
    notes: ReturnType<typeof buildEntitiesFromRows>['notes'];
    cards: ReturnType<typeof buildEntitiesFromRows>['cards'];
  },
  nextDeckId: string,
) {
  const firstDeck = entities.decks[0];
  if (!firstDeck || firstDeck.id === nextDeckId) {
    return entities;
  }

  const previousDeckId = firstDeck.id;

  return {
    decks: entities.decks.map((deck, index) => (index === 0 ? { ...deck, id: nextDeckId } : deck)),
    notes: entities.notes.map((note) =>
      note.deckId === previousDeckId
        ? {
            ...note,
            deckId: nextDeckId,
          }
        : note
    ),
    cards: entities.cards.map((card) =>
      card.deckId === previousDeckId
        ? {
            ...card,
            deckId: nextDeckId,
          }
        : card
    ),
  };
}

function getAnkiCardId(card: Pick<LearningCard, 'anki'>) {
  const cardId = card.anki?.cardId;
  return cardId ? String(cardId) : undefined;
}

function preserveReplacementCardProgress(
  replacementCards: LearningCard[],
  previousCards: LearningCard[],
) {
  const previousCardsById = new Map(previousCards.map((card) => [card.id, card]));
  const previousCardsByAnkiId = new Map(
    previousCards.flatMap((card) => {
      const ankiCardId = getAnkiCardId(card);
      return ankiCardId ? [[ankiCardId, card] as const] : [];
    }),
  );

  return replacementCards.map((replacementCard) => {
    const ankiCardId = getAnkiCardId(replacementCard);
    const previousCard = previousCardsById.get(replacementCard.id)
      || (ankiCardId ? previousCardsByAnkiId.get(ankiCardId) : undefined);
    if (!previousCard) {
      return replacementCard;
    }

    return {
      ...replacementCard,
      // Anki IDs are stable template identities. Retaining the existing local
      // ID keeps review logs and private scheduling references intact even if
      // the bundled template was regenerated.
      id: previousCard.id,
      noteId: previousCard.noteId,
      deckId: previousCard.deckId,
      state: previousCard.state,
      dueAt: previousCard.dueAt,
      intervalDays: previousCard.intervalDays,
      easeFactor: previousCard.easeFactor,
      reps: previousCard.reps,
      lapses: previousCard.lapses,
      stepIndex: previousCard.stepIndex,
      scheduledDays: previousCard.scheduledDays,
      elapsedDays: previousCard.elapsedDays,
      memoryState: previousCard.memoryState,
      lastReviewedAt: previousCard.lastReviewedAt,
      createdAt: previousCard.createdAt,
      updatedAt: previousCard.updatedAt,
    };
  });
}

export const createLearningImportSlice: StateCreator<LearningStore, [], [], LearningImportSlice> = (set, get) => ({
  seedStarterDeck: () => {
    if (Object.keys(get().decks).length > 0) {
      return;
    }

    const entities = buildEntitiesFromRows(getStarterDeckRows(), Date.now(), { sourceType: 'starter' });
    const importJob = createLearningImportJob(
      'starter-vokabeln.json',
      'template',
      entities.decks.map((deck) => deck.id),
      entities.cards.length,
    );

    set((state) => ({
      ...applyLearningStoreIndexes({
        ...state,
        ...mergeLearningImportedEntities(state, entities, importJob),
      }),
    }));
  },

  importTemplateDeck: async (templateId) => {
    const template = getFeaturedDeckTemplates().find((entry) => entry.id === templateId);
    if (!template) {
      return {
        status: 'failed',
        job: null,
        error: 'Template konnte nicht gefunden werden.',
      };
    }

    const existingDecks = Object.values(get().decks).filter(
      (deck) =>
        deck.sourceTemplateId === template.id ||
        template.deckNames.some((deckName) => deck.name.trim().toLowerCase() === deckName.trim().toLowerCase()),
    );
    if (existingDecks.length > 0 && !template.replaceExistingOnImport) {
      const existingCards = Object.values(get().cards).filter((card) => existingDecks.some((deck) => deck.id === card.deckId));
      return {
        status: 'already-existed',
        job: createLearningImportJob(
          `${template.title}.json`,
          'template',
          existingDecks.map((deck) => deck.id),
          existingCards.length,
        ),
      };
    }

    try {
      const importedEntities = await buildFeaturedTemplateEntities(template, Date.now());
      const replacementDeckId = template.replaceExistingOnImport ? existingDecks[0]?.id : undefined;
      const entities = replacementDeckId
        ? remapImportedDeckIds(importedEntities, replacementDeckId)
        : importedEntities;
      const importJob = createLearningImportJob(
        `${template.title}.json`,
        'template',
        entities.decks.map((deck) => deck.id),
        entities.cards.length,
      );

      if (template.replaceExistingOnImport && existingDecks.length > 0) {
        set((state) => {
          const nextDeckId = entities.decks[0]?.id;
          const previousCards = Object.values(state.cards).filter((card) => card.deckId === nextDeckId);
          const refreshedCards = preserveReplacementCardProgress(entities.cards, previousCards);
          const existingDeck = nextDeckId ? state.decks[nextDeckId] : undefined;
          const refreshedEntities = {
            ...entities,
            cards: refreshedCards,
            decks: entities.decks.map((deck, index) => {
              if (index !== 0 || !existingDeck) return deck;

              const preservedCardIds = Object.values(state.cards)
                .filter((card) => card.deckId === deck.id)
                .map((card) => card.id);
              return {
                ...existingDeck,
                ...deck,
                id: existingDeck.id,
                cardIds: Array.from(new Set([
                  ...preservedCardIds,
                  ...refreshedCards.filter((card) => card.deckId === deck.id).map((card) => card.id),
                ])),
                createdAt: Math.min(existingDeck.createdAt, deck.createdAt),
                updatedAt: Date.now(),
              };
            }),
          };
          const merged = mergeLearningImportedEntities(state, refreshedEntities, importJob);

          return applyLearningStoreIndexes({
            ...merged,
            // A template refresh is additive: custom cards, review logs,
            // assignments and unlock history remain owned by the user.
            reviewLogs: state.reviewLogs,
            assignments: state.assignments,
            unlockGrants: state.unlockGrants,
            learningCloudLocalSyncState: state.learningCloudLocalSyncState,
          });
        });
      } else {
        set((state) => ({
          ...applyLearningStoreIndexes({
            ...state,
            ...mergeLearningImportedEntities(state, entities, importJob),
          }),
        }));
      }

      return {
        status: 'imported',
        job: importJob,
      };
    } catch (error) {
      const importJob = createLearningImportJob(
        `${template.title}.json`,
        'template',
        [],
        0,
        error instanceof Error ? error.message : 'Template import failed',
      );

      set((state) => ({
        importJobs: appendLearningImportJob(state.importJobs, importJob),
      }));

      return {
        status: 'failed',
        job: importJob,
        error: importJob.error,
      };
    }
  },

  importFromCsv: (filename, content) => {
    try {
      const rows = parseCsv(content);
      const entities = buildEntitiesFromRows(rows);
      const importJob = createLearningImportJob(
        filename,
        'csv',
        entities.decks.map((deck) => deck.id),
        entities.cards.length,
      );

      set((state) => ({
        ...applyLearningStoreIndexes({
          ...state,
          ...mergeLearningImportedEntities(state, entities, importJob),
        }),
      }));

      return importJob;
    } catch (error) {
      const importJob = createLearningImportJob(
        filename,
        'csv',
        [],
        0,
        error instanceof Error ? error.message : 'CSV import failed',
      );
      set((state) => ({
        importJobs: appendLearningImportJob(state.importJobs, importJob),
      }));
      return importJob;
    }
  },

  importFromJson: (filename, payload) => {
    try {
      const rows = normalizeImportPayload(payload);
      const entities = buildEntitiesFromRows(rows);
      const importJob = createLearningImportJob(
        filename,
        'json',
        entities.decks.map((deck) => deck.id),
        entities.cards.length,
      );

      set((state) => ({
        ...applyLearningStoreIndexes({
          ...state,
          ...mergeLearningImportedEntities(state, entities, importJob),
        }),
      }));

      return importJob;
    } catch (error) {
      const importJob = createLearningImportJob(
        filename,
        'json',
        [],
        0,
        error instanceof Error ? error.message : 'JSON import failed',
      );
      set((state) => ({
        importJobs: appendLearningImportJob(state.importJobs, importJob),
      }));
      return importJob;
    }
  },

  importFromAnkiPackage: async (filename, content) => {
    try {
      // Lazy: sql.js is only needed for Anki imports. The worker also keeps
      // ZIP, SQLite, media, and card-template work off the UI thread.
      const { parseAnkiPackageInWorker } = await import('@/modules/learning/workers/ankiImportWorker');
      const { rows, reviewLogs } = await parseAnkiPackageInWorker(filename, content);
      const entities = buildEntitiesFromRows(rows, Date.now(), {
        sourceType: 'anki',
      });
      const importJob = createLearningImportJob(
        filename,
        'anki',
        entities.decks.map((deck) => deck.id),
        entities.cards.length,
      );

      set((state) => {
        const merged = mergeLearningImportedEntities(state, entities, importJob);
        const localCardBySourceId = new Map(
          entities.cards
            .map((card) => [card.anki?.cardId, card] as const)
            .filter((entry): entry is [string, typeof entities.cards[number]] => Boolean(entry[0])),
        );
        const importedReviewLogs = reviewLogs
          .map((log) => {
            const localCard = localCardBySourceId.get(log.sourceCardId);
            if (!localCard) {
              return null;
            }

            return migrateReviewLog({
              id: `anki_revlog_${log.anki?.reviewId || log.reviewedAt}_${log.sourceCardId}`,
              deckId: localCard.deckId,
              cardId: localCard.id,
              reviewedAt: log.reviewedAt,
              rating: log.rating,
              previousState: log.previousState,
              newState: log.newState,
              scheduledDays: log.scheduledDays,
              elapsedDays: log.elapsedDays,
              wasCorrect: log.wasCorrect,
              memoryStateBefore: log.memoryStateBefore,
              memoryStateAfter: log.memoryStateAfter,
              anki: log.anki,
            });
          })
          .filter((log): log is NonNullable<typeof log> => Boolean(log));
        const nextReviewLogs = {
          ...state.reviewLogs,
          ...Object.fromEntries(importedReviewLogs.map((log) => [log.id, log])),
        };

        return {
          ...applyLearningStoreIndexes({
            ...state,
            ...merged,
            reviewLogs: nextReviewLogs,
          }),
        };
      });

      return importJob;
    } catch (error) {
      const importJob = createLearningImportJob(
        filename,
        'anki',
        [],
        0,
        error instanceof Error ? error.message : 'Anki-Import fehlgeschlagen',
      );
      set((state) => ({
        importJobs: appendLearningImportJob(state.importJobs, importJob),
      }));
      return importJob;
    }
  },

  createManualCard: (input: LearningManualCardInput) => {
    const existingDeck = input.deckId ? get().decks[input.deckId] : undefined;
    const deckName = input.deckName?.trim() || existingDeck?.name;
    if (!deckName || !input.front.trim() || !input.back.trim()) {
      return null;
    }

    const entities = buildEntitiesFromRows([
      {
        deck: deckName,
        front: input.front,
        back: input.back,
        type: input.type,
        tags: input.tags || [],
        language: input.language || 'de',
        clozeText: input.clozeText || '',
        expectedAnswer: input.expectedAnswer || input.back,
        mediaUrl: input.mediaUrl || '',
      },
    ]);
    const importJob = createLearningImportJob(
      `${deckName}-manual.json`,
      'manual',
      entities.decks.map((deck) => deck.id),
      entities.cards.length,
    );

    set((state) => {
      const importedDeck = entities.decks[0];
      const importedNote = entities.notes[0];
      const importedCard = entities.cards[0];

      if (!importedDeck || !importedNote || !importedCard) {
        return state;
      }

      if (existingDeck) {
        const nextNote = { ...importedNote, deckId: existingDeck.id };
        const mediaState = registerLearningMediaArtifacts(
          {
            mediaRegistry: state.mediaRegistry,
            mediaTransferQueue: state.mediaTransferQueue,
          },
          [nextNote],
          importJob.source,
        );

        return applyLearningStoreIndexes({
          ...state,
          activeDeckId: existingDeck.id,
          activeDeckUpdatedAt: state.activeDeckId === existingDeck.id ? state.activeDeckUpdatedAt : Date.now(),
          decks: {
            ...state.decks,
            [existingDeck.id]: {
              ...existingDeck,
              cardIds: [...existingDeck.cardIds, importedCard.id],
              tags: Array.from(new Set([...existingDeck.tags, ...importedNote.tags])),
              updatedAt: Date.now(),
            },
          },
          notes: { ...state.notes, [nextNote.id]: nextNote },
          cards: {
            ...state.cards,
            [importedCard.id]: migrateLearningCard({ ...importedCard, deckId: existingDeck.id }),
          },
          importJobs: appendLearningImportJob(state.importJobs, importJob),
          ...mediaState,
        });
      }

      return applyLearningStoreIndexes({
        ...state,
        ...mergeLearningImportedEntities(state, entities, importJob),
      });
    });

    return importJob;
  },

  exportDeckToJson: (deckId) => {
    const deck = get().decks[deckId];
    const notes = Object.values(get().notes).filter((note) => note.deckId === deckId);
    const cards = Object.values(get().cards).filter((card) => card.deckId === deckId);
    return buildDeckExportPayload(deck, notes, cards);
  },
});
