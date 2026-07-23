import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildEntitiesFromRows,
  buildReviewQueue,
  getDefaultLearningPreset,
  getFeaturedDeckTemplates,
  normalizeImportPayload,
} from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';
import { buildLearnHubSummary } from '@/lib/view-models/learn';


describe('template imports', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it('imports a featured template only once', async () => {
    const template = getFeaturedDeckTemplates()[0];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        notes: [
          { deck: template.deckNames[0], front: 'salam', back: 'hallo', type: 'basic', language: template.language },
        ],
      }),
    } as Response);

    const firstImport = await useLearningStore.getState().importTemplateDeck(template.id);
    const secondImport = await useLearningStore.getState().importTemplateDeck(template.id);

    expect(firstImport.status).toBe('imported');
    expect(secondImport.status).toBe('already-existed');
    expect(firstImport.job?.importedDeckIds).toHaveLength(1);
    expect(secondImport.job?.importedDeckIds).toEqual(firstImport.job?.importedDeckIds);
    expect(Object.values(useLearningStore.getState().decks)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().decks)[0]?.sourceTemplateId).toBe(template.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('updates a legacy Jean-Paul deck without deleting unmatched cards or review history', async () => {
    const template = getFeaturedDeckTemplates().find((entry) => entry.id === 'jean-paul');
    const existing = buildEntitiesFromRows(
      [{ deck: 'Jean-Paul', front: 'salam', back: 'hallo', type: 'basic', language: 'fr' }],
      1_700_000_000_000,
    );

    useLearningStore.setState({
      decks: Object.fromEntries(existing.decks.map(d => [d.id, d])),
      notes: Object.fromEntries(existing.notes.map(n => [n.id, n])),
      cards: Object.fromEntries(existing.cards.map(c => [c.id, c])),
      reviewLogs: {
        log_existing: {
          id: 'log_existing',
          deckId: existing.decks[0].id,
          cardId: existing.cards[0].id,
          reviewedAt: 1_700_000_100_000,
          rating: 'good',
          previousState: 'new',
          newState: 'learning',
          scheduledDays: 1,
          elapsedDays: 0,
          wasCorrect: true,
          memoryStateBefore: null,
          memoryStateAfter: null,
        },
      },
      assignments: [
        {
          id: 'assignment_existing',
          targetId: 'target-app',
          targetType: 'app',
          deckId: existing.decks[0].id,
          unlockDurationMinutes: 15,
          enabled: true,
          updatedAt: 1_700_000_100_000,
        },
      ],
      unlockGrants: [
        {
          id: 'grant_existing',
          targetId: 'target-app',
          targetType: 'app',
          grantedAt: 1_700_000_100_000,
          expiresAt: 1_700_000_200_000,
          sourceDeckId: existing.decks[0].id,
          sessionCreditsRequired: 7,
        },
      ],
      activeDeckId: existing.decks[0]?.id,
      activeDeckUpdatedAt: existing.decks[0]?.updatedAt,
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          deck: 'Jean Paul',
          front: 'nouveau',
          back: 'neu',
          type: 'basic',
          language: 'fr',
          card: {
            createdAt: 1_599_601_956_228,
            lastReviewedAt: 1_763_145_617_051,
            dueAt: 1_791_946_800_000,
            reps: 8,
            lapses: 0,
            intervalDays: 334,
            easeFactor: 2.35,
          },
        },
      ]),
    } as Response);
    const result = await useLearningStore.getState().importTemplateDeck(template!.id);

    expect(result.status).toBe('imported');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.values(useLearningStore.getState().decks)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().decks)[0]?.id).toBe(existing.decks[0]?.id);
    expect(Object.values(useLearningStore.getState().decks)[0]?.name).toBe('Jean Paul');
    expect(Object.values(useLearningStore.getState().notes)).toHaveLength(2);
    expect(Object.values(useLearningStore.getState().notes).some((note) => note.front === 'nouveau')).toBe(true);
    expect(Object.values(useLearningStore.getState().notes).some((note) => note.front === 'salam')).toBe(true);
    expect(Object.values(useLearningStore.getState().cards)).toHaveLength(2);
    expect(Object.values(useLearningStore.getState().cards).every((card) => card.deckId === existing.decks[0]?.id)).toBe(true);
    expect(Object.values(useLearningStore.getState().reviewLogs)).toHaveLength(1);
    expect(useLearningStore.getState().assignments[0]?.deckId).toBe(existing.decks[0]?.id);
    expect(useLearningStore.getState().unlockGrants[0]?.sourceDeckId).toBe(existing.decks[0]?.id);
  });

  it('updates Jean Paul without removing private cards or their review history', async () => {
    const template = getFeaturedDeckTemplates().find((entry) => entry.id === 'jean-paul');
    const sourceRow = {
      deck: 'Jean Paul',
      front: 'ancien',
      back: 'alt',
      type: 'basic' as const,
      language: 'fr',
      anki: {
        deck: { deckId: '42', collectionCreatedAt: 1_700_000_000_000 },
        note: { noteId: '100', modelId: '12', modelName: 'Basic', sortField: 'ancien', tags: [], fields: [], noteModifiedAt: 1_700_000_000_000 },
        card: { cardId: '200', noteId: '100', deckId: '42', templateOrdinal: 0, templateName: 'Karte 1', queue: 0, cardType: 0, due: 0, interval: 0, factor: 2500, reps: 0, lapses: 0, leftCount: 0, cardModifiedAt: 1_700_000_000_000 },
      },
    };
    const source = buildEntitiesFromRows([sourceRow], 1_700_000_000_000, {
      sourceTemplateId: 'jean-paul',
      sourceType: 'template',
    });
    const privateEntities = buildEntitiesFromRows(
      [{ deck: 'Private additions', front: 'meine karte', back: 'my card', type: 'basic', language: 'fr' }],
      1_700_000_100_000,
    );
    const deckId = source.decks[0].id;
    const privateNote = { ...privateEntities.notes[0], deckId };
    const privateCard = { ...privateEntities.cards[0], deckId, noteId: privateNote.id };

    useLearningStore.setState({
      decks: {
        [deckId]: {
          ...source.decks[0],
          cardIds: [...source.decks[0].cardIds, privateCard.id],
        },
      },
      notes: {
        [source.notes[0].id]: source.notes[0],
        [privateNote.id]: privateNote,
      },
      cards: {
        [source.cards[0].id]: source.cards[0],
        [privateCard.id]: privateCard,
      },
      reviewLogs: {
        private_review: {
          id: 'private_review',
          deckId,
          cardId: privateCard.id,
          reviewedAt: 1_700_000_200_000,
          rating: 'good',
          previousState: 'new',
          newState: 'learning',
          scheduledDays: 1,
          elapsedDays: 0,
          wasCorrect: true,
          memoryStateBefore: null,
          memoryStateAfter: null,
        },
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ ...sourceRow, front: 'neu', back: 'new' }],
    } as Response);

    const result = await useLearningStore.getState().importTemplateDeck(template!.id);

    expect(result.status).toBe('imported');
    expect(useLearningStore.getState().notes[privateNote.id]).toMatchObject({ front: 'meine karte', deckId });
    expect(useLearningStore.getState().cards[privateCard.id]).toMatchObject({ deckId, noteId: privateNote.id });
    expect(useLearningStore.getState().reviewLogs.private_review).toMatchObject({ cardId: privateCard.id });
    expect(useLearningStore.getState().decks[deckId]?.cardIds).toContain(privateCard.id);
  });

  it('repairs a Jean-Paul deck without losing matching Anki scheduling or review history', async () => {
    const template = getFeaturedDeckTemplates().find((entry) => entry.id === 'jean-paul');
    const importedRow = {
      deck: 'Jean Paul',
      front: 'mari',
      back: 'le mari',
      type: 'basic' as const,
      language: 'fr',
      anki: {
        deck: {
          deckId: '42',
          originalName: 'Jean Paul',
          collectionCreatedAt: 1_700_000_000_000,
        },
        note: {
          noteId: '9001',
          modelId: '12',
          modelName: 'Basic',
          sortField: 'mari',
          tags: [],
          fields: [],
          noteModifiedAt: 1_700_000_000_000,
        },
        card: {
          cardId: '9002',
          noteId: '9001',
          deckId: '42',
          templateOrdinal: 0,
          templateName: 'Karte 1',
          queue: 2,
          cardType: 2,
          due: 8,
          interval: 14,
          factor: 2500,
          reps: 4,
          lapses: 1,
          leftCount: 0,
          cardModifiedAt: 1_700_000_000_000,
          lastReviewAt: 1_700_000_000_000,
        },
      },
    };
    const existing = buildEntitiesFromRows([importedRow], 1_700_000_000_000);
    const legacyCard = {
      ...existing.cards[0],
      id: 'legacy-card',
      noteId: 'legacy-note',
      state: 'review' as const,
      dueAt: 1_800_000_000_000,
      intervalDays: 30,
      reps: 11,
      lapses: 2,
      lastReviewedAt: 1_799_000_000_000,
    };

    useLearningStore.setState({
      decks: Object.fromEntries(existing.decks.map((deck) => [deck.id, deck])),
      notes: {},
      cards: { [legacyCard.id]: legacyCard },
      reviewLogs: {
        log_legacy: {
          id: 'log_legacy',
          deckId: existing.decks[0].id,
          cardId: legacyCard.id,
          reviewedAt: 1_799_000_000_000,
          rating: 'good',
          previousState: 'learning',
          newState: 'review',
          scheduledDays: 30,
          elapsedDays: 12,
          wasCorrect: true,
          memoryStateBefore: null,
          memoryStateAfter: null,
        },
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [importedRow],
    } as Response);

    const result = await useLearningStore.getState().importTemplateDeck(template!.id);
    const repairedCard = Object.values(useLearningStore.getState().cards)[0];
    const repairedLog = Object.values(useLearningStore.getState().reviewLogs)[0];

    expect(result.status).toBe('imported');
    expect(repairedCard).toMatchObject({ reps: 11, dueAt: 1_800_000_000_000, state: 'review' });
    expect(repairedLog).toMatchObject({ id: 'log_legacy', cardId: repairedCard.id });
  });

  it('keeps the bundled Jean Paul template lean and immediately reviewable', () => {
    const assetPath = path.resolve('public/learn-templates/jean-paul.json');
    const assetBytes = fs.statSync(assetPath).size;
    const payload = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
    const rows = normalizeImportPayload(payload);
    const now = Date.now();
    const entities = buildEntitiesFromRows(rows, now, {
      sourceTemplateId: 'jean-paul',
      sourceType: 'template',
    });
    const queue = buildReviewQueue(entities.cards, 10, now);

    expect(assetBytes).toBeLessThan(32 * 1024 * 1024);
    expect(payload.reviewLogs).toBeUndefined();
    expect(rows).toHaveLength(3251);
    expect(entities.decks[0]?.name).toBe('Jean Paul');
    expect(queue.length).toBeGreaterThan(0);
  });

  it('keeps the bundled Jean Paul Spanish template fresh and separate', () => {
    const assetPath = path.resolve('public/learn-templates/jean-paul-spanish.json');
    const payload = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
    const rows = normalizeImportPayload(payload);
    const now = Date.now();
    const entities = buildEntitiesFromRows(rows, now, {
      sourceTemplateId: 'jean-paul-spanish',
      sourceType: 'template',
    });
    const queue = buildReviewQueue(entities.cards, 10, now);

    expect(rows).toHaveLength(3251);
    expect(payload.reviewLogs).toBeUndefined();
    expect(rows.some((row) => row.card || row.anki)).toBe(false);
    expect(rows[0]).toMatchObject({
      deck: 'Jean Paul Spanisch',
      front: 'der/die/das (+ mask., fem.)',
      back: 'el,la',
      language: 'es',
      expectedAnswer: 'el,la',
    });
    expect(entities.decks[0]).toMatchObject({
      name: 'Jean Paul Spanisch',
      language: 'es',
      sourceTemplateId: 'jean-paul-spanish',
    });
    expect(entities.cards.every((card) =>
      card.state === 'new'
      && card.dueAt === now
      && card.reps === 0
      && card.lastReviewedAt === undefined
    )).toBe(true);
    expect(queue.length).toBeGreaterThan(0);
  });

  it('keeps template decks with starter tags visible, including imports saved before source metadata existed', () => {
    const importedTemplateDeck = {
      id: 'jp-es',
      name: 'Jean Paul Spanisch',
      description: 'Deutsch-Spanisch Starterdeck',
      language: 'es',
      tags: ['jean-paul-spanish', 'spanish', 'starter', 'freq-1'],
      cardIds: [],
      sourceTemplateId: 'jean-paul-spanish',
      sourceType: 'template',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const legacyImportedTemplateDeck = {
      ...importedTemplateDeck,
      id: 'legacy-jp-es',
      sourceTemplateId: undefined,
      sourceType: undefined,
    };
    const legacyStarterDeck = {
      ...importedTemplateDeck,
      id: 'legacy-starter',
      name: 'Starter Vokabeln',
      sourceTemplateId: undefined,
      sourceType: undefined,
    };

    const summary = buildLearnHubSummary({
      activeDeckId: 'jp-es',
      decks: [importedTemplateDeck, legacyImportedTemplateDeck, legacyStarterDeck],
      getDeckStats: () => null,
      getResolvedPresetForDeck: () => ({
        ...getDefaultLearningPreset(),
        reviewsBetweenNewCards: 15,
      }),
    });

    expect(summary.starterDeckCount).toBe(1);
    expect(summary.deckStats.map((deck) => deck.id)).toEqual(['jp-es', 'legacy-jp-es']);
  });
});
