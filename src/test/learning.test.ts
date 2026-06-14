import { describe, expect, it } from 'vitest';
import {
  advanceReviewQueue,
  buildEntitiesFromRows,
  buildDeckExportPayload,
  buildReviewResult,
  buildUnlockSessionQueue,
  buildUnlockSessionCandidateIds,
  buildReviewQueue,
  clampRequiredCorrectReviews,
  formatReviewInterval,
  getDeckLearningStats,
  getReviewIntervalPreview,
  getFeaturedDeckTemplates,
  getDueCards,
  getDefaultGateRule,
  getDefaultLearningPreset,
  getUnlockCredit,
  isTypedAnswerCorrect,
  isFeaturedDeckTemplateImported,
  normalizeImportPayload,
  shouldRequireTypedAnswer,
  parseCsv,
} from '@/lib/learning';
import type { ReviewLog } from '@/lib/learning';

describe('learning import', () => {
  it('parses csv rows into importable cards', () => {
    const csv = [
      'deck,front,back,type,tags,language,clozeText,expectedAnswer,mediaUrl',
      'Spanisch,hola,Hallo,basic,starter|greeting,de,,,',
      'Spanisch,"Yo {{c1::aprendo}} rapido",aprendo,cloze,starter,es,"Yo {{c1::aprendo}} rapido",aprendo,',
    ].join('\n');

    const rows = parseCsv(csv);
    const entities = buildEntitiesFromRows(rows, 1_700_000_000_000);

    expect(rows).toHaveLength(2);
    expect(entities.decks).toHaveLength(1);
    expect(entities.cards).toHaveLength(2);
    expect(entities.notes[1].type).toBe('cloze');
  });

  it('builds an export payload for an existing deck', () => {
    const entities = buildEntitiesFromRows([{ deck: 'Spanisch', front: 'hola', back: 'Hallo', type: 'basic' }], 1_700_000_000_000);
    const payload = buildDeckExportPayload(entities.decks[0], entities.notes);

    expect(payload?.decks).toHaveLength(1);
    expect(payload?.decks?.[0].name).toBe('Spanisch');
    expect(payload?.decks?.[0].notes[0].front).toBe('hola');
  });

  it('preserves card scheduling metadata across export and re-import', () => {
    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows([{ deck: 'Spanisch', front: 'hola', back: 'Hallo', type: 'basic' }], now);
    const reviewedCard = buildReviewResult(entities.cards[0], 'good', true, now).updatedCard;
    const payload = buildDeckExportPayload(entities.decks[0], entities.notes, [reviewedCard]);
    const reimported = buildEntitiesFromRows(normalizeImportPayload(payload || { notes: [] }), now);

    expect(reimported.cards[0].state).toBe(reviewedCard.state);
    expect(reimported.cards[0].dueAt).toBe(reviewedCard.dueAt);
    expect(reimported.cards[0].reps).toBe(reviewedCard.reps);
    expect(reimported.cards[0].lastReviewedAt).toBe(reviewedCard.lastReviewedAt);
  });

  it('preserves note timestamps across export and re-import', () => {
    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows([{ deck: 'Spanisch', front: 'hola', back: 'Hallo', type: 'basic' }], now);
    const updatedNote = {
      ...entities.notes[0],
      back: 'Guten Tag',
      updatedAt: now + 42_000,
    };
    const payload = buildDeckExportPayload(entities.decks[0], [updatedNote], entities.cards);
    const reimported = buildEntitiesFromRows(normalizeImportPayload(payload || { notes: [] }), now + 100_000);

    expect(reimported.notes[0].createdAt).toBe(updatedNote.createdAt);
    expect(reimported.notes[0].updatedAt).toBe(updatedNote.updatedAt);
    expect(reimported.decks[0].updatedAt).toBe(updatedNote.updatedAt);
  });

  it('reuses imported card timestamps for notes and deck timelines', () => {
    const importedAt = 1_700_000_000_000;
    const reviewedAt = importedAt + 5 * 24 * 60 * 60 * 1000;
    const entities = buildEntitiesFromRows([
      {
        deck: 'Jean Paul',
        front: 'mari',
        back: 'husband',
        type: 'basic',
        card: {
          createdAt: importedAt,
          lastReviewedAt: reviewedAt,
        },
      },
    ], reviewedAt + 1_000);

    expect(entities.notes[0].createdAt).toBe(importedAt);
    expect(entities.decks[0].createdAt).toBe(importedAt);
    expect(entities.decks[0].updatedAt).toBe(reviewedAt);
  });

  it('provides featured deck templates', () => {
    const templates = getFeaturedDeckTemplates();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0].cardCount).toBeGreaterThan(0);
    expect(templates[0].deckNames.length).toBeGreaterThan(0);
  });

  it('registers the Jean Paul featured template with legacy deck-name matching', () => {
    const template = getFeaturedDeckTemplates().find((entry) => entry.id === 'jean-paul');

    expect(template).toMatchObject({
      title: 'Jean Paul 2.0',
      language: 'fr',
      cardCount: 3251,
    });
    expect(template?.deckNames).toEqual(['Jean Paul', 'Jean-Paul']);
    expect(
      isFeaturedDeckTemplateImported(template!, [
        { id: 'deck-1', name: 'Jean-Paul', description: '', language: 'fr', tags: [], cardIds: [], createdAt: 0, updatedAt: 0 },
      ]),
    ).toBe(true);
  });

  it('registers the Jean Paul Spanish template separately from the French deck', () => {
    const templates = getFeaturedDeckTemplates();
    const frenchTemplate = templates.find((entry) => entry.id === 'jean-paul');
    const spanishTemplate = templates.find((entry) => entry.id === 'jean-paul-spanish');

    expect(spanishTemplate).toMatchObject({
      title: 'Jean Paul Spanisch',
      language: 'es',
      cardCount: 3251,
      assetPath: 'learn-templates/jean-paul-spanish.json',
    });
    expect(spanishTemplate?.deckNames).toEqual(['Jean Paul Spanisch', 'Jean-Paul Spanisch']);
    expect(spanishTemplate?.replaceExistingOnImport).toBeUndefined();
    expect(spanishTemplate?.id).not.toBe(frenchTemplate?.id);
    expect(spanishTemplate?.assetPath).not.toBe(frenchTemplate?.assetPath);
  });

  it('preserves Jean Paul review metadata when import payload includes card history', () => {
    const now = 1_700_000_000_000;
    const importedAt = now - 2 * 24 * 60 * 60 * 1000;
    const payload = {
      decks: [
        {
          name: 'Jean Paul',
          description: 'Persoenliches Deck',
          language: 'fr',
          tags: ['anki', 'personal', 'french'],
          notes: [
            {
              front: 'le mari',
              back: 'n. husband',
              type: 'basic',
              tags: ['n'],
              language: 'fr',
              card: {
                state: 'review',
                dueAt: now + 3 * 24 * 60 * 60 * 1000,
                intervalDays: 12,
                easeFactor: 2.42,
                reps: 17,
                lapses: 2,
                stepIndex: 0,
                scheduledDays: 12,
                elapsedDays: 5,
                memoryState: {
                  stability: 19.25,
                  difficulty: 3.75,
                },
                lastReviewedAt: importedAt,
                createdAt: importedAt,
              },
            },
          ],
        },
      ],
    };

    const rows = normalizeImportPayload(payload);
    const entities = buildEntitiesFromRows(rows, now, {
      sourceTemplateId: 'jean-paul',
      sourceType: 'template',
    });

    expect(entities.decks[0]).toMatchObject({
      name: 'Jean Paul',
      sourceTemplateId: 'jean-paul',
      sourceType: 'template',
    });
    expect(entities.cards[0]).toMatchObject({
      state: 'review',
      dueAt: now + 3 * 24 * 60 * 60 * 1000,
      intervalDays: 12,
      easeFactor: 2.42,
      reps: 17,
      lapses: 2,
      stepIndex: 0,
      scheduledDays: 12,
      elapsedDays: 5,
      lastReviewedAt: importedAt,
      createdAt: importedAt,
    });
    expect(entities.cards[0].memoryState).toEqual({
      stability: 19.25,
      difficulty: 3.75,
    });
  });

  it('preserves imported vocabulary content and language metadata without translating it', () => {
    const entities = buildEntitiesFromRows(
      [{ deck: 'Francais', front: 'bonjour', back: 'guten tag', type: 'basic', language: 'fr' }],
      1_700_000_000_000,
    );

    expect(entities.decks[0].language).toBe('fr');
    expect(entities.notes[0].language).toBe('fr');
    expect(entities.notes[0].front).toBe('bonjour');
    expect(entities.notes[0].back).toBe('guten tag');
  });
});

describe('learning scheduler', () => {
  it('moves a new card into review after a successful answer', () => {
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      1_700_000_000_000,
    );
    const initialCard = cards[0];

    const firstPass = buildReviewResult(initialCard, 'good', true, 1_700_000_000_000);
    const secondPass = buildReviewResult(firstPass.updatedCard, 'good', true, 1_700_000_600_000);

    expect(firstPass.updatedCard.state).toBe('learning');
    expect(secondPass.updatedCard.state).toBe('review');
    expect(secondPass.updatedCard.intervalDays).toBeGreaterThan(0);
  });

  it('returns only due cards', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'one', back: 'eins', type: 'basic' },
        { deck: 'Deck', front: 'two', back: 'zwei', type: 'basic' },
      ],
      now,
    );

    cards[0] = {
      ...cards[0],
      state: 'review',
      dueAt: now - 1,
      intervalDays: 2,
      scheduledDays: 2,
      lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000,
    };
    cards[1] = {
      ...cards[1],
      state: 'review',
      dueAt: now + 60_000,
      intervalDays: 2,
      scheduledDays: 2,
      lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000,
    };

    expect(getDueCards(cards, undefined, now)).toHaveLength(1);
  });

  it('does not surface learning cards before dueAt and resurfaces them right after', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    const learningCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    expect(learningCard.state).toBe('learning');
    expect(learningCard.dueAt).toBeGreaterThan(now);

    const beforeDueQueue = buildUnlockSessionQueue({
      cards: [learningCard],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 1,
      now,
    });
    const afterDueQueue = buildUnlockSessionQueue({
      cards: [learningCard],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 1,
      now: learningCard.dueAt + 1,
    });

    expect(beforeDueQueue).toHaveLength(0);
    expect(afterDueQueue).toEqual([learningCard.id]);
  });

  it('can keep review-ahead cards out of blocking unlock queues after they were scheduled later', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );
    const scheduledLaterCard = {
      ...cards[0],
      state: 'review' as const,
      dueAt: now + 60 * 60 * 1000,
      intervalDays: 1,
      scheduledDays: 1,
      reps: 1,
      lastReviewedAt: now,
      updatedAt: now,
    };
    const baseOptions = {
      cards: [scheduledLaterCard],
      preset: getDefaultLearningPreset(),
      gateRule: {
        ...getDefaultGateRule(),
        reviewAheadHours: 24,
      },
      sessionCreditsRequired: 1,
      now,
    };

    expect(buildUnlockSessionQueue(baseOptions)).toEqual([scheduledLaterCard.id]);
    expect(buildUnlockSessionQueue({ ...baseOptions, includeReviewAhead: false })).toHaveLength(0);
  });

  it('does not reuse a recently reviewed card as block-session filler before its future due date', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );
    const reviewedCard = {
      ...buildReviewResult(cards[0], 'good', true, now).updatedCard,
      state: 'review' as const,
      dueAt: now + 30 * 24 * 60 * 60 * 1000,
      lastReviewedAt: now,
      updatedAt: now,
    };

    const queue = buildUnlockSessionQueue({
      cards: [reviewedCard],
      preset: getDefaultLearningPreset(),
      gateRule: {
        ...getDefaultGateRule(),
        reviewAheadHours: 24,
      },
      sessionCreditsRequired: 1,
      now: now + 5 * 60 * 1000,
    });

    expect(queue).toHaveLength(0);
  });

  it('surfaces a block-session review card exactly when its stored dueAt is reached', () => {
    const now = 1_700_000_000_000;
    const dueAt = now + 30 * 24 * 60 * 60 * 1000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );
    const reviewedCard = {
      ...buildReviewResult(cards[0], 'good', true, now).updatedCard,
      state: 'review' as const,
      dueAt,
      lastReviewedAt: now,
      updatedAt: now,
    };
    const baseOptions = {
      cards: [reviewedCard],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 1,
      includeReviewAhead: false,
    };

    expect(buildUnlockSessionQueue({ ...baseOptions, now: dueAt - 1 })).toHaveLength(0);
    expect(buildUnlockSessionQueue({ ...baseOptions, now: dueAt })).toEqual([reviewedCard.id]);
  });

  it('orders review outcomes by the next actual reappearance time', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    const learningCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    const reviewCard = buildReviewResult(learningCard, 'good', true, learningCard.dueAt + 1).updatedCard;

    const again = buildReviewResult(reviewCard, 'again', false, reviewCard.dueAt + 1).updatedCard;
    const hard = buildReviewResult(reviewCard, 'hard', true, reviewCard.dueAt + 1).updatedCard;
    const good = buildReviewResult(reviewCard, 'good', true, reviewCard.dueAt + 1).updatedCard;
    const easy = buildReviewResult(reviewCard, 'easy', true, reviewCard.dueAt + 1).updatedCard;

    expect(again.dueAt).toBeLessThan(hard.dueAt);
    expect(hard.dueAt).toBeLessThan(good.dueAt);
    expect(good.dueAt).toBeLessThan(easy.dueAt);
  });

  it('keeps the requested review count even when the deck is smaller', () => {
    expect(clampRequiredCorrectReviews(8, 3)).toBe(8);
    expect(clampRequiredCorrectReviews(0, 3)).toBe(1);
    expect(clampRequiredCorrectReviews(5, 0)).toBe(5);
  });

  it('keeps the next queued card available after removing the current review', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'one', back: 'eins', type: 'basic' },
        { deck: 'Deck', front: 'two', back: 'zwei', type: 'basic' },
        { deck: 'Deck', front: 'three', back: 'drei', type: 'basic' },
      ],
      now,
    );

    const reviewQueue = buildReviewQueue(cards, 3, now);
    const remainingQueue = advanceReviewQueue(reviewQueue, cards[0].id);

    expect(reviewQueue).toEqual(cards.map((card) => card.id));
    expect(remainingQueue[0]).toBe(cards[1].id);
    expect(remainingQueue).toEqual([cards[1].id, cards[2].id]);
  });

  it('removes only the first matching queue entry so repeated cards stay reviewable', () => {
    const queue = ['card-a', 'card-b', 'card-a', 'card-c'];

    expect(advanceReviewQueue(queue, 'card-a')).toEqual(['card-b', 'card-a', 'card-c']);
  });

  it('checks typed answers against the expected basic translation', () => {
    const { cards, notes } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      1_700_000_000_000,
    );

    expect(isTypedAnswerCorrect(cards[0], notes[0], 'Haus')).toBe(true);
    expect(isTypedAnswerCorrect(cards[0], notes[0], 'haus.')).toBe(true);
    expect(isTypedAnswerCorrect(cards[0], notes[0], 'Wohnung')).toBe(false);
    expect(isTypedAnswerCorrect(cards[0], notes[0], '   ')).toBe(false);
  });

  it('accepts typed answers once the first 3 letters match (Tip-Modus)', () => {
    const { cards, notes } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'focus', back: 'konzentriert', type: 'basic' }],
      1_700_000_000_000,
    );

    expect(isTypedAnswerCorrect(cards[0], notes[0], 'kon')).toBe(true);
    expect(isTypedAnswerCorrect(cards[0], notes[0], 'ko')).toBe(false);
    expect(isTypedAnswerCorrect(cards[0], notes[0], 'zent')).toBe(false);
  });

  it('accepts German transliterations in typed answers', () => {
    const { cards, notes } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'door', back: 'Tür', type: 'basic' }],
      1_700_000_000_000,
    );

    expect(isTypedAnswerCorrect(cards[0], notes[0], 'Tür')).toBe(true);
    expect(isTypedAnswerCorrect(cards[0], notes[0], 'Tuer')).toBe(true);
  });

  it('forces wrong answers back to again in the scheduler', () => {
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      1_700_000_000_000,
    );

    const result = buildReviewResult(cards[0], 'easy', false, 1_700_000_600_000);

    expect(result.log.rating).toBe('again');
    expect(result.updatedCard.state).toBe('learning');
  });

  it('returns a human-readable next interval preview for answer buttons', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    expect(getReviewIntervalPreview(cards[0], 'again', false, now)).toBe('1m');
    // Deterministischer Fuzz-Seed (siehe getFsrsScheduler): das Easy-Intervall
    // einer frischen Karte fällt reproduzierbar auf 10d — wichtig ist, dass
    // Vorschau und gespeicherte Fälligkeit denselben Wert liefern.
    expect(getReviewIntervalPreview(cards[0], 'easy', true, now)).toBe('10d');
  });

  it('keeps the previewed interval identical to the stored interval despite fuzz (deterministic seed)', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    // Reife Review-Karte mit großem Intervall, sodass FSRS-Fuzz greift (>= 2.5 Tage).
    const matureCard = {
      ...cards[0],
      state: 'review' as const,
      reps: 8,
      lapses: 0,
      memoryState: { stability: 60, difficulty: 5 },
      dueAt: now - 24 * 60 * 60 * 1000,
      lastReviewedAt: now - 24 * 60 * 60 * 1000,
      intervalDays: 45,
      scheduledDays: 45,
    };

    // Vorschau zum Render-Zeitpunkt; tatsächliches Scheduling 1.234s später
    // (anderer Wall-Clock-ms-Wert) — vor dem Seed-Fix würfelte das einen anderen
    // Fuzz-Wert und damit ein abweichendes Intervall. Gilt für ALLE vier Buttons
    // (again, schwer, gut, einfach), nicht nur "schwer".
    const storedDaysByRating: Record<string, number> = {};
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const previewResult = buildReviewResult(matureCard, rating, true, now).updatedCard;
      const storedResult = buildReviewResult(matureCard, rating, true, now + 1_234).updatedCard;
      // dueAt ist relativ zur jeweiligen "now"; das gespeicherte INTERVALL
      // (scheduledDays) muss in Vorschau und Submit identisch sein.
      expect(storedResult.scheduledDays).toBe(previewResult.scheduledDays);
      // Und das angezeigte Label stimmt mit der gespeicherten Fälligkeit überein.
      expect(formatReviewInterval(storedResult.dueAt, now + 1_234)).toBe(
        formatReviewInterval(previewResult.dueAt, now),
      );
      storedDaysByRating[rating] = storedResult.scheduledDays;
    }

    // Die Reihenfolge der Intervalle bleibt trotz Fuzz monoton: again < gut < einfach.
    expect(storedDaysByRating.again).toBeLessThan(storedDaysByRating.good);
    expect(storedDaysByRating.good).toBeLessThanOrEqual(storedDaysByRating.easy);
  });

  it('maps answer-button ratings to different future due timestamps', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    const againDueAt = buildReviewResult(cards[0], 'again', true, now).updatedCard.dueAt;
    const goodDueAt = buildReviewResult(cards[0], 'good', true, now).updatedCard.dueAt;
    const easyDueAt = buildReviewResult(cards[0], 'easy', true, now).updatedCard.dueAt;

    expect(againDueAt).toBeGreaterThan(now);
    expect(goodDueAt).toBeGreaterThan(againDueAt);
    expect(easyDueAt).toBeGreaterThan(goodDueAt);
  });

  it('only returns a reviewed card after its stored due timestamp is reached', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' },
        { deck: 'Deck', front: 'tree', back: 'Baum', type: 'basic' },
      ],
      now,
    );

    const reviewedCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    const stillDueCard = {
      ...cards[1],
      state: 'review' as const,
      dueAt: now - 60_000,
      reps: 1,
      intervalDays: 1,
      lastReviewedAt: now - 120_000,
    };

    expect(getDueCards([reviewedCard, stillDueCard], undefined, now).map((card) => card.id)).toEqual([stillDueCard.id]);
    expect(getDueCards([reviewedCard, stillDueCard], undefined, reviewedCard.dueAt).map((card) => card.id)).toEqual([
      reviewedCard.id,
      stillDueCard.id,
    ]);
  });

  it('requires typed answers only up to the configured word limit for basic cards', () => {
    const { cards, notes } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'focus', back: 'ich bleibe heute konzentriert', type: 'basic' }],
      1_700_000_000_000,
    );

    expect(shouldRequireTypedAnswer(cards[0], notes[0], 5)).toBe(true);
    expect(shouldRequireTypedAnswer(cards[0], notes[0], 3)).toBe(false);
  });

  it('can disable typed answers globally for review cards', () => {
    const { cards, notes } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      1_700_000_000_000,
    );

    expect(shouldRequireTypedAnswer(cards[0], notes[0], 3, false)).toBe(false);
  });

  it('provides a default word limit for typed answers', () => {
    expect(getDefaultGateRule().typedAnswerMaxWords).toBe(3);
  });

  it('counts every non-again review as one unlock step', () => {
    expect(getUnlockCredit('again', false)).toBe(0);
    expect(getUnlockCredit('hard', true)).toBe(1);
    expect(getUnlockCredit('good', true)).toBe(1);
    expect(getUnlockCredit('easy', true)).toBe(1);
  });

  it('builds unlock sessions due-first before new cards', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'due', back: 'fällig', type: 'basic' },
        { deck: 'Deck', front: 'new', back: 'neu', type: 'basic' },
      ],
      now,
    );

    const reviewedCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    reviewedCard.dueAt = now - 60_000;

    const queue = buildUnlockSessionQueue({
      cards: [reviewedCard, cards[1]],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 2,
      now,
    });

    expect(queue[0]).toBe(reviewedCard.id);
    expect(queue[1]).toBe(cards[1].id);
  });

  it('interleaves new cards into review-heavy sessions with the configured 1-to-15 mix', () => {
    const now = 1_700_000_000_000;
    const rows = [
      ...Array.from({ length: 17 }, (_, index) => ({
        deck: 'Deck',
        front: `review-${index + 1}`,
        back: `alt-${index + 1}`,
        type: 'basic' as const,
      })),
      { deck: 'Deck', front: 'new-1', back: 'neu-1', type: 'basic' as const },
      { deck: 'Deck', front: 'new-2', back: 'neu-2', type: 'basic' as const },
    ];
    const { cards } = buildEntitiesFromRows(rows, now);
    const reviewCards = cards.slice(0, 17).map((card, index) => ({
      ...buildReviewResult(card, 'good', true, now + index).updatedCard,
      state: 'review' as const,
      dueAt: now - 60_000,
    }));
    const newCards = cards.slice(17);

    const queue = buildUnlockSessionQueue({
      cards: [...reviewCards, ...newCards],
      preset: {
        ...getDefaultLearningPreset(),
        reviewsBetweenNewCards: 15,
      },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 19,
      now,
    });

    expect(queue.slice(0, 16)).toEqual([
      ...reviewCards.slice(0, 15).map((card) => card.id),
      newCards[0].id,
    ]);
    expect(queue[16]).toBe(reviewCards[15].id);
    expect(queue[17]).toBe(reviewCards[16].id);
    expect(queue[18]).toBe(newCards[1].id);
  });

  it('does not repeat cards inside the same unlock session when the deck is smaller than the required count', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'one', back: 'eins', type: 'basic' }],
      now,
    );

    const queue = buildUnlockSessionQueue({
      cards,
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      now,
    });

    expect(queue).toEqual([cards[0].id]);
  });

  it('uses review-ahead only for review-style cards inside the configured window', () => {
    const now = 1_700_000_000_000;
    const { cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'learning', back: 'lernen', type: 'basic' },
        { deck: 'Deck', front: 'review', back: 'wiederholen', type: 'basic' },
        { deck: 'Deck', front: 'new', back: 'neu', type: 'basic' },
      ],
      now,
    );

    const learningCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    const reviewCard = {
      ...buildReviewResult(
        buildReviewResult(cards[1], 'good', true, now).updatedCard,
        'good',
        true,
        now + 60_000,
      ).updatedCard,
      dueAt: now + 2 * 60 * 60 * 1000,
      state: 'review' as const,
    };

    const queue = buildUnlockSessionQueue({
      cards: [learningCard, reviewCard, cards[2]],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      now,
    });

    expect(queue).toContain(reviewCard.id);
    expect(queue).toContain(cards[2].id);
    expect(queue).not.toContain(learningCard.id);
  });

  it('keeps the next new card in the candidate stream when the review mix is larger than the current review backlog', () => {
    const now = 1_700_000_000_000;
    const rows = [
      ...Array.from({ length: 9 }, (_, index) => ({
        deck: 'Deck',
        front: `card-${index + 1}`,
        back: `wort-${index + 1}`,
        type: 'basic' as const,
      })),
    ];
    const { cards } = buildEntitiesFromRows(rows, now);
    const reviewCards = cards.slice(0, 8).map((card, index) => ({
      ...buildReviewResult(card, 'good', true, now + index).updatedCard,
      state: 'review' as const,
      dueAt: now - 60_000,
    }));
    const newCard = cards[8];

    const candidateIds = buildUnlockSessionCandidateIds({
      cards: [...reviewCards, newCard],
      deckId: reviewCards[0]?.deckId,
      reviewLogs: [],
      preset: {
        ...getDefaultLearningPreset(),
        reviewsBetweenNewCards: 10,
      },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 8,
      ignoreNewCardsLimit: true,
      now,
    });

    expect(candidateIds).toEqual([
      ...reviewCards.map((card) => card.id),
      newCard.id,
    ]);
  });

  it('introduces a new card across flows once cumulative reviews reach the ratio', () => {
    const now = 1_700_000_000_000;
    const rows = Array.from({ length: 9 }, (_, index) => ({
      deck: 'Deck',
      front: `q-${index + 1}`,
      back: `a-${index + 1}`,
      type: 'basic' as const,
    }));
    const { cards } = buildEntitiesFromRows(rows, now);
    const deckId = cards[0].deckId;
    const reviewCards = cards.slice(0, 8).map((card, index) => ({
      ...buildReviewResult(card, 'good', true, now + index).updatedCard,
      state: 'review' as const,
      dueAt: now - 60_000,
    }));
    const newCard = cards[8];

    // 15 kumulative Reviews heute (ueber mehrere Flows); previousState 'review'
    // => newCardsIntroducedToday bleibt 0.
    const reviewLogs: ReviewLog[] = Array.from({ length: 15 }, (_, index) => ({
      id: `log-${index}`,
      deckId,
      cardId: reviewCards[index % reviewCards.length].id,
      reviewedAt: now - 1_000 * (index + 1),
      rating: 'good',
      previousState: 'review',
      newState: 'review',
      scheduledDays: 1,
      elapsedDays: 1,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    }));

    const baseOptions = {
      cards: [...reviewCards, newCard],
      deckId,
      preset: { ...getDefaultLearningPreset(), reviewsBetweenNewCards: 15 },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      now,
    };

    // Trotz kleiner 3-Karten-Kappung (die Reviews sonst fuellen wuerden) taucht
    // die faellige neue Karte auf — Pacing zaehlt kumulativ ueber Flows.
    expect(buildUnlockSessionQueue({ ...baseOptions, reviewLogs })).toContain(newCard.id);

    // Gegenprobe: bei nur 5 kumulativen Reviews ist noch keine neue Karte faellig.
    expect(
      buildUnlockSessionQueue({ ...baseOptions, reviewLogs: reviewLogs.slice(0, 5) }),
    ).not.toContain(newCard.id);
  });

  it('keeps unlock queues scoped to the explicit deck context', () => {
    const now = 1_700_000_000_000;
    const { decks, cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck A', front: 'due', back: 'fällig', type: 'basic' },
        { deck: 'Deck A', front: 'new-a', back: 'neu a', type: 'basic' },
        { deck: 'Deck B', front: 'new-b', back: 'neu b', type: 'basic' },
      ],
      now,
    );

    const deckA = decks.find((deck) => deck.name === 'Deck A');
    const dueCard = {
      ...buildReviewResult(cards[0], 'good', true, now).updatedCard,
      dueAt: now - 60_000,
      state: 'review' as const,
    };

    const queue = buildUnlockSessionQueue({
      cards: [dueCard, cards[1], cards[2]],
      deckId: deckA?.id,
      reviewLogs: [],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      now,
    });

    expect(queue).toEqual([dueCard.id, cards[1].id]);
    expect(queue).not.toContain(cards[2].id);
  });

  it('can keep surfacing additional new cards for continuous learn mode after the daily new-card budget is used', () => {
    const now = 1_700_000_000_000;
    const { decks, cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'one', back: 'eins', type: 'basic' },
        { deck: 'Deck', front: 'two', back: 'zwei', type: 'basic' },
        { deck: 'Deck', front: 'three', back: 'drei', type: 'basic' },
        { deck: 'Deck', front: 'four', back: 'vier', type: 'basic' },
      ],
      now,
    );

    const deckId = decks[0]?.id;
    const preset = {
      ...getDefaultLearningPreset(),
      newCardsPerDay: 0,
    };

    const limitedQueue = buildUnlockSessionQueue({
      cards,
      deckId,
      reviewLogs: [],
      preset,
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      now,
    });
    const continuousQueue = buildUnlockSessionQueue({
      cards,
      deckId,
      reviewLogs: [],
      preset,
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      ignoreNewCardsLimit: true,
      now,
    });

    expect(limitedQueue).toHaveLength(0);
    expect(continuousQueue).toEqual([cards[0].id, cards[1].id, cards[2].id]);
  });

  it('surfaces an owed new card across short blocking sessions once the daily review mix is reached', () => {
    const now = 1_700_000_000_000;
    const { decks, cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'due-1', back: 'fällig 1', type: 'basic' },
        { deck: 'Deck', front: 'due-2', back: 'fällig 2', type: 'basic' },
        { deck: 'Deck', front: 'due-3', back: 'fällig 3', type: 'basic' },
        { deck: 'Deck', front: 'new-1', back: 'neu 1', type: 'basic' },
      ],
      now,
    );
    const deckId = decks[0]!.id;
    const dueCards = cards.slice(0, 3).map((card, index) => ({
      ...buildReviewResult(card, 'good', true, now + index).updatedCard,
      state: 'review' as const,
      dueAt: now - 60_000,
    }));
    const reviewLogs: ReviewLog[] = Array.from({ length: 10 }, (_, index) => ({
      id: `log-${index}`,
      deckId,
      cardId: dueCards[index % dueCards.length]!.id,
      reviewedAt: now - 5_000 + index,
      rating: 'good',
      previousState: 'review',
      newState: 'review',
      scheduledDays: 1,
      elapsedDays: 1,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    }));

    const queue = buildUnlockSessionQueue({
      cards: [...dueCards, cards[3]!],
      deckId,
      reviewLogs,
      preset: {
        ...getDefaultLearningPreset(),
        reviewsBetweenNewCards: 10,
        newCardsPerDay: 3,
      },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      now,
    });

    expect(queue).toEqual([
      cards[3]!.id,
      dueCards[0]!.id,
      dueCards[1]!.id,
    ]);
  });

  it('counts new-card pacing across days and resets after a new card is introduced', () => {
    const now = 1_700_000_000_000;
    const dayMs = 24 * 60 * 60 * 1000;
    const { decks, cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck', front: 'due-1', back: 'fällig 1', type: 'basic' },
        { deck: 'Deck', front: 'due-2', back: 'fällig 2', type: 'basic' },
        { deck: 'Deck', front: 'due-3', back: 'fällig 3', type: 'basic' },
        { deck: 'Deck', front: 'new-1', back: 'neu 1', type: 'basic' },
      ],
      now - 60 * dayMs,
    );
    const deckId = decks[0]!.id;
    const dueCards = cards.slice(0, 3).map((card) => ({
      ...card,
      state: 'review' as const,
      reps: 5,
      memoryState: { stability: 30, difficulty: 5 },
      dueAt: now - 60_000,
    }));
    const newCard = { ...cards[3]!, state: 'new' as const, reps: 0, memoryState: null, dueAt: cards[3]!.createdAt };

    // 15 Reviews über DREI Tage verteilt (5 pro Tag) — ein Tageszähler würde
    // jede Nacht zurückgesetzt und nie 15 erreichen; der "seit letzter neuer
    // Karte"-Zähler zählt durch.
    const spreadReviewLogs: ReviewLog[] = Array.from({ length: 15 }, (_, index) => ({
      id: `log-${index}`,
      deckId,
      cardId: dueCards[index % dueCards.length]!.id,
      reviewedAt: now - (2 - Math.floor(index / 5)) * dayMs - (5 - (index % 5)) * 1_000,
      rating: 'good',
      previousState: 'review',
      newState: 'review',
      scheduledDays: 1,
      elapsedDays: 1,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    }));

    const baseOptions = {
      cards: [...dueCards, newCard],
      deckId,
      preset: { ...getDefaultLearningPreset(), reviewsBetweenNewCards: 15 },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 3,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      now,
    };

    // 15 kumulative Reviews über mehrere Tage → neue Karte ist fällig.
    expect(buildUnlockSessionQueue({ ...baseOptions, reviewLogs: spreadReviewLogs })).toContain(newCard.id);

    // Sobald die neue Karte eingeführt wurde (previousState 'new'), startet der
    // Zähler neu — eine weitere neue Karte ist NICHT sofort fällig.
    const afterIntroductionLogs: ReviewLog[] = [
      ...spreadReviewLogs,
      {
        id: 'log-new-intro',
        deckId,
        cardId: newCard.id,
        reviewedAt: now - 1_000,
        rating: 'good',
        previousState: 'new',
        newState: 'learning',
        scheduledDays: 0,
        elapsedDays: 0,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
      },
    ];
    const introducedNewCard = { ...newCard, state: 'learning' as const, reps: 1, dueAt: now + 600_000 };
    const secondNewCard = {
      ...cards[3]!,
      id: 'card-new-2',
      noteId: 'note-new-2',
      state: 'new' as const,
      reps: 0,
      memoryState: null,
      dueAt: cards[3]!.createdAt,
    };

    expect(
      buildUnlockSessionQueue({
        ...baseOptions,
        cards: [...dueCards, introducedNewCard, secondNewCard],
        reviewLogs: afterIntroductionLogs,
      }),
    ).not.toContain(secondNewCard.id);
  });

  it('never lists the same card twice in a session even when sibling dedup is off', () => {
    const now = 1_700_000_000_000;
    const { decks, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'word', back: 'wort', type: 'basic' }],
      now,
    );
    const deckId = decks[0]!.id;
    const dueCard = {
      ...cards[0],
      state: 'review' as const,
      reps: 3,
      memoryState: { stability: 10, difficulty: 5 },
      dueAt: now - 60_000,
    };

    // Künstliches Duplikat derselben Karten-ID + burySiblings aus: ohne die
    // ID-Dedup-Invariante erschiene die Vokabel doppelt in der Session.
    const queue = buildUnlockSessionQueue({
      cards: [dueCard, { ...dueCard }],
      deckId,
      reviewLogs: [],
      preset: { ...getDefaultLearningPreset(), burySiblings: false },
      gateRule: getDefaultGateRule(),
      sessionCreditsRequired: 5,
      ignoreNewCardsLimit: true,
      now,
    });

    expect(queue.filter((id) => id === dueCard.id)).toHaveLength(1);
  });

  it('reports richer deck stats for passive sessions', () => {
    const now = 1_700_000_000_000;
    const { decks, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );
    const reviewedCard = buildReviewResult(cards[0], 'good', true, now).updatedCard;
    reviewedCard.dueAt = now - 60_000;

    const stats = getDeckLearningStats({
      deck: decks[0],
      cards: [reviewedCard],
      reviewLogs: [],
      preset: getDefaultLearningPreset(),
      gateRule: getDefaultGateRule(),
      now,
    });

    expect(stats.dueNowCount).toBe(1);
    expect(stats.newLeftToday).toBe(3);
    expect(stats.optimizerStatus).toBe('collecting');
  });
});
