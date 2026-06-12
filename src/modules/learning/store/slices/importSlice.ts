import type { StateCreator } from 'zustand';
import {
  buildDeckExportPayload,
  buildEntitiesFromRows,
  getFeaturedDeckTemplates,
  getStarterDeckRows,
  loadFeaturedDeckTemplateRows,
  migrateLearningDeck,
  migrateLearningCard,
  migrateReviewLog,
  normalizeImportPayload,
  parseCsv,
} from '@/lib/learning';
import { parseAnkiPackage } from '@/lib/ankiImport';
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

export const createLearningImportSlice: StateCreator<LearningStore, [], [], LearningImportSlice> = (set, get) => ({
  seedStarterDeck: () => {
    if (Object.keys(get().decks).length > 0) {
      return;
    }

    const entities = buildEntitiesFromRows(getStarterDeckRows());
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
      const rows = await loadFeaturedDeckTemplateRows(templateId);
      const importedEntities = buildEntitiesFromRows(rows, Date.now(), {
        sourceTemplateId: template.id,
        sourceType: 'template',
      });
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
        const replacedDeckIds = new Set(existingDecks.map((deck) => deck.id));
        const removedCardIds = new Set(
          Object.values(get().cards)
            .filter((card) => replacedDeckIds.has(card.deckId))
            .map((card) => card.id),
        );
        const removedNoteIds = new Set(
          Object.values(get().notes)
            .filter((note) => replacedDeckIds.has(note.deckId))
            .map((note) => note.id),
        );
        const removedReviewLogIds = new Set(
          Object.values(get().reviewLogs)
            .filter((log) => replacedDeckIds.has(log.deckId) || removedCardIds.has(log.cardId))
            .map((log) => log.id),
        );
        const nextDeckId = entities.decks[0]?.id;
        const now = Date.now();

        set((state) => {
          const filteredState = {
            ...state,
            activeDeckId: state.activeDeckId && replacedDeckIds.has(state.activeDeckId)
              ? nextDeckId
              : state.activeDeckId,
            activeDeckUpdatedAt: state.activeDeckId && replacedDeckIds.has(state.activeDeckId)
              ? now
              : state.activeDeckUpdatedAt,
            decks: Object.fromEntries(Object.entries(state.decks).filter(([k]) => !replacedDeckIds.has(k))),
            notes: Object.fromEntries(Object.entries(state.notes).filter(([, note]) => !replacedDeckIds.has(note.deckId))),
            cards: Object.fromEntries(Object.entries(state.cards).filter(([, card]) => !replacedDeckIds.has(card.deckId))),
            importJobs: state.importJobs,
            mediaRegistry: state.mediaRegistry,
            mediaTransferQueue: state.mediaTransferQueue,
          };
          const merged = mergeLearningImportedEntities(filteredState, entities, importJob);

          return applyLearningStoreIndexes({
            ...merged,
            reviewLogs: Object.fromEntries(Object.entries(state.reviewLogs).filter(
              ([, log]) => !replacedDeckIds.has(log.deckId) && !removedCardIds.has(log.cardId),
            )),
            assignments: nextDeckId
              ? state.assignments.map((assignment) =>
                  replacedDeckIds.has(assignment.deckId)
                    ? {
                        ...assignment,
                        deckId: nextDeckId,
                        updatedAt: now,
                      }
                    : assignment
                )
              : state.assignments,
            unlockGrants: nextDeckId
              ? state.unlockGrants.map((grant) =>
                  replacedDeckIds.has(grant.sourceDeckId)
                    ? {
                        ...grant,
                        sourceDeckId: nextDeckId,
                      }
                    : grant
                )
              : state.unlockGrants,
            learningCloudLocalSyncState: {
              ...state.learningCloudLocalSyncState,
              deletedDecks: nextDeckId
                ? state.learningCloudLocalSyncState.deletedDecks
                : appendLearningCloudTombstones(
                    state.learningCloudLocalSyncState.deletedDecks,
                    Array.from(replacedDeckIds),
                    now,
                  ),
              deletedNotes: appendLearningCloudTombstones(
                state.learningCloudLocalSyncState.deletedNotes,
                Array.from(removedNoteIds),
                now,
              ),
              deletedCards: appendLearningCloudTombstones(
                state.learningCloudLocalSyncState.deletedCards,
                Array.from(removedCardIds),
                now,
              ),
              deletedReviewLogs: appendLearningCloudTombstones(
                state.learningCloudLocalSyncState.deletedReviewLogs,
                Array.from(removedReviewLogIds),
                now,
              ),
            },
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
      const { rows, reviewLogs } = await parseAnkiPackage(filename, content);
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
