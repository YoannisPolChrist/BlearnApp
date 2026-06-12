import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildEntitiesFromRows,
  buildReviewQueue,
  getFeaturedDeckTemplates,
  normalizeImportPayload,
} from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';

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

  it('replaces a legacy Jean-Paul deck with the Jean Paul 2.0 template state', async () => {
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
    expect(Object.values(useLearningStore.getState().notes)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().notes)[0]?.front).toBe('nouveau');
    expect(Object.values(useLearningStore.getState().cards)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().cards)[0]?.deckId).toBe(existing.decks[0]?.id);
    expect(Object.values(useLearningStore.getState().cards)[0]?.reps).toBe(8);
    expect(Object.values(useLearningStore.getState().reviewLogs)).toHaveLength(0);
    expect(useLearningStore.getState().assignments[0]?.deckId).toBe(existing.decks[0]?.id);
    expect(useLearningStore.getState().unlockGrants[0]?.sourceDeckId).toBe(existing.decks[0]?.id);
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
});
