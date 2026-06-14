import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';

const dismissBlockingOverlayMock = vi.fn<() => Promise<void>>();
const abandonPendingNavigationMock = vi.fn<(sessionId?: string | null) => Promise<void>>();
const grantManualOverrideMock = vi.fn<
  (targetId: string, targetType: 'app' | 'website' | 'search', unlockDurationMinutes?: number) => Promise<unknown>
>();
const openTargetMock = vi.fn<
  (targetId: string, targetType: 'app' | 'website' | 'search') => Promise<void>
>();
const primeNativeUnlockHandoffMock = vi.fn<
  (targetId: string, targetType: 'app' | 'website' | 'search', unlockDurationMinutes?: number | null) => Promise<void>
>();
const waitForPersistStorageIdleMock = vi.fn<(storageKey: string, timeoutMs?: number) => Promise<void>>();
const flushLearningCloudSaveIfAvailableMock = vi.fn<(reason: string) => Promise<boolean>>();

function mockSharedUi() {
  vi.doMock('@/components/PageTransition', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));
  vi.doMock('@/components/GlassCard', () => ({
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }));
  vi.doMock('@/hooks/useNativeRouteReady', () => ({
    useNativeRouteReady: () => undefined,
  }));
  vi.doMock('@/components/blocking/BlockingUnlockSuccessScreen', () => ({
    BlockingUnlockSuccessScreen: ({
      buttonLabel = 'App freischalten',
      onContinue,
      targetLabel,
      unlockDurationMinutes,
    }: {
      buttonLabel?: string;
      onContinue: () => void;
      targetLabel?: string | null;
      unlockDurationMinutes?: number | null;
    }) => (
      <div>
        <div>{targetLabel || 'Freigabe'}</div>
        <div>{unlockDurationMinutes ? `${unlockDurationMinutes} Min frei` : 'Freigabe aktiv'}</div>
        <button type="button" onClick={onContinue}>
          {buttonLabel}
        </button>
      </div>
    ),
  }));
  vi.doMock('@/components/ui/SuccessAnimation', () => ({
    SuccessAnimation: ({
      visible,
      message,
      subMessage,
      detailMessage,
      onAnimationDone,
    }: {
      visible: boolean;
      message?: string;
      subMessage?: string;
      detailMessage?: string;
      onAnimationDone?: () => void;
    }) =>
      visible ? (
        <div>
          <div>{message}</div>
          {subMessage ? <div>{subMessage}</div> : null}
          {detailMessage ? <div>{detailMessage}</div> : null}
          <button type="button" onClick={onAnimationDone}>
            finish-success
          </button>
        </div>
      ) : null,
  }));
}

async function loadLearnReviewPage(options?: { applyMocks?: () => void }) {
  vi.resetModules();
  mockSharedUi();
  dismissBlockingOverlayMock.mockReset();
  abandonPendingNavigationMock.mockReset();
  grantManualOverrideMock.mockReset();
  openTargetMock.mockReset();
  primeNativeUnlockHandoffMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  flushLearningCloudSaveIfAvailableMock.mockReset();

  abandonPendingNavigationMock.mockResolvedValue(undefined);
  grantManualOverrideMock.mockResolvedValue({
    supported: true,
    active: true,
    granted: true,
    attemptsUsed: 1,
    attemptsRemaining: 2,
    maxAttempts: 3,
  });
  primeNativeUnlockHandoffMock.mockResolvedValue(undefined);
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);
  flushLearningCloudSaveIfAvailableMock.mockResolvedValue(true);

  options?.applyMocks?.();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return {
      ...actual,
      waitForPersistStorageIdle: waitForPersistStorageIdleMock,
    };
  });
  vi.doMock('@/lib/learningCloudImmediateSave', () => ({
    flushLearningCloudSaveIfAvailable: flushLearningCloudSaveIfAvailableMock,
  }));
  vi.doMock('@/lib/nativeUnlockHandoff', () => ({
    primeNativeUnlockHandoff: primeNativeUnlockHandoffMock,
  }));
  vi.doMock('@/services/screenTimeService', () => ({
    abandonPendingNavigation: abandonPendingNavigationMock,
    dismissBlockingOverlay: dismissBlockingOverlayMock,
    grantManualOverride: grantManualOverrideMock,
    openTarget: openTargetMock,
  }));
  const [{ default: LearnReviewPage }, { useAppStore }, { useLearningStore }] = await Promise.all([
    import('@/pages/LearnReview'),
    import('@/store/useAppStore'),
    import('@/store/useLearningStore'),
  ]);

  return { LearnReviewPage, useAppStore, useLearningStore };
}

async function renderReviewSession(
  sessionCreditsRequired: number,
  options?: {
    typedAnswerEnabled?: boolean;
    targetId?: string | null;
    overlaySessionId?: string | null;
    includeDeckIdInRoute?: boolean;
    applyMocks?: () => void;
    prepareStore?: (stores: {
      useAppStore: Awaited<ReturnType<typeof loadLearnReviewPage>>['useAppStore'];
      useLearningStore: Awaited<ReturnType<typeof loadLearnReviewPage>>['useLearningStore'];
      deckId: string;
    }) => void;
  },
) {
  const { LearnReviewPage, useAppStore, useLearningStore } = await loadLearnReviewPage({
    applyMocks: options?.applyMocks,
  });


  useAppStore.setState(
    {
      ...useAppStore.getInitialState(),
      defaultUnlockDurationMinutes: 99,
    },
    true,
  );
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useLearningStore.getState().seedStarterDeck();

  const deckId = Object.values(useLearningStore.getState().decks)[0]?.id;
  expect(deckId).toBeTruthy();

  useLearningStore.getState().setGateRule({
    typedAnswerEnabled: options?.typedAnswerEnabled ?? true,
    sessionCreditsRequired,
    unlockDurationMinutes: 99,
  });

  const targetId = options && 'targetId' in options ? options.targetId : 'YouTube';
  const overlaySessionId = options?.overlaySessionId;
  const includeDeckIdInRoute = options?.includeDeckIdInRoute ?? true;
  if (targetId) {
    useLearningStore.getState().upsertAssignment(targetId, 'app', deckId!, {
      sessionCreditsRequired,
      unlockDurationMinutes: 99,
    });
  }

  options?.prepareStore?.({
    useAppStore,
    useLearningStore,
    deckId: deckId!,
  });

  const learnReviewPath = targetId
    ? `/learn/review?targetId=${targetId}&targetType=app${includeDeckIdInRoute ? `&deckId=${deckId}` : ''}&unlockDurationMinutes=12&targetLabel=${targetId}${overlaySessionId ? `&overlaySessionId=${overlaySessionId}` : ''}`
    : `/learn/review?deckId=${deckId}`;

  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[learnReviewPath]}>
      <LocationProbe />
      <Routes>
        <Route path="/learn/review" element={<LearnReviewPage />} />
        <Route path="/breathing" element={<div>Breathing fallback screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  return { useAppStore, useLearningStore };
}

function getProgressCard() {
  return screen.getByText(/fortschritt/i).parentElement as HTMLElement;
}

async function findRevealButton() {
  return screen.findByRole('button', { name: /zeigen/i });
}

function getCheckTypedAnswerButton() {
  const button = screen
    .getAllByRole('button')
    .find((candidate) => /antwort/i.test(candidate.textContent ?? '') && /pr/i.test(candidate.textContent ?? ''));
  if (!button) {
    throw new Error('Missing typed-answer check button');
  }

  return button;
}

async function answerWrongAndReveal() {
  fireEvent.change(await screen.findByPlaceholderText('Antwort eingeben'), {
    target: { value: 'zzz' },
  });
  fireEvent.click(screen.getByRole('button', { name: /antwort pr(?:ü|ue|Ã¼|ÃƒÆ’Ã‚Â¼)fen/i }));
  expect(screen.getByText(/2 versuche frei/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /l(?:ö|oe|Ã¶|ÃƒÆ’Ã‚Â¶)sung zeigen/i }));
  await screen.findByRole('button', { name: /easy/i });
}

function emotionPromptPresent() {
  return screen.queryByRole('heading', { name: /wie f(?:ü|ue|Ã¼|ÃƒÂ¼)hlst du dich/i }) !== null;
}

function clickEmotionButton(label: string) {
  const textNode = screen.getByText(label, { exact: false });
  const button = textNode.closest('button');
  if (!button) {
    throw new Error(`Missing emotion button for ${label}`);
  }

  fireEvent.click(button);
}

async function advanceSessionToEmotionStep(maxRounds = 8) {
  for (let round = 0; round < maxRounds; round += 1) {
    if (emotionPromptPresent()) {
      return;
    }

    const revealButton = await screen.findByRole('button', {
      name: /^antwort zeigen$/i,
    });
    fireEvent.click(revealButton);
    fireEvent.click(await screen.findByRole('button', { name: /good/i }));
  }

  await waitFor(() => {
    expect(emotionPromptPresent()).toBe(true);
  }, { timeout: 10000 });
}

async function completeEmotionSelection() {
  await waitFor(() => {
    expect(emotionPromptPresent()).toBe(true);
  }, { timeout: 10000 });

  clickEmotionButton('Erleichtert');
  fireEvent.click(screen.getAllByRole('button', { name: /abschlie/i })[0]);
}

// Im Blocking-Flow schaltet Blearn nach genug Reviews SOFORT frei — ohne
// Emotions-Gate (sonst bliebe der Nutzer trotz erfüllter Aufgabe gesperrt).
// Diese Hilfe beantwortet einfach die nötigen Reviews; der Unlock feuert dann
// automatisch.
async function answerBlockedSessionReviews(maxRounds = 8) {
  for (let round = 0; round < maxRounds; round += 1) {
    const revealButton = screen.queryByRole('button', { name: /^antwort zeigen$/i });
    if (!revealButton) {
      return;
    }
    fireEvent.click(revealButton);
    const goodButton = screen.queryByRole('button', { name: /good/i });
    if (!goodButton) {
      return;
    }
    fireEvent.click(goodButton);
  }
}

// Nach genug Reviews zeigt der Block-Flow erst den Erfolgs-Screen
// ("Freigeschaltet …" + "Zur App"); der CTA dort öffnet das Ziel.
async function answerBlockedSessionToUnlock(maxRounds = 8) {
  await answerBlockedSessionReviews(maxRounds);
  const continueButton = await screen.findByRole('button', { name: /zur app/i });
  fireEvent.click(continueButton);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.doUnmock('@/components/PageTransition');
  vi.doUnmock('@/components/GlassCard');
  vi.doUnmock('@/hooks/useNativeRouteReady');
  vi.doUnmock('@/components/blocking/BlockingUnlockSuccessScreen');
  vi.doUnmock('@/components/ui/SuccessAnimation');
  vi.doUnmock('@/components/learn-review/LearnReviewActions');
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/lib/persistStorage');
  vi.doUnmock('@/services/screenTimeService');
  vi.resetModules();
});

describe('Learn review typed-answer UI', () => {
  it('shows only the pure card content on the front side', async () => {
    await renderReviewSession(1);

    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(screen.queryByText(/Antwort aus dem Kopf/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kurz erinnern, dann aufdecken/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tippe deine Antwort ein/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Halte die Antwort kurz im Kopf/i)).not.toBeInTheDocument();
  }, 10000);

  it('shows the next new card timing instead of separate new and review stat tiles', async () => {
    await renderReviewSession(5);

    expect(await screen.findByText(/mix 1:/i)).toBeInTheDocument();
    expect(screen.getByText(/neue karte|nächste neue|naechste neue|heute keine neue/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/^neu$/i).length).toBeLessThanOrEqual(1);
    expect(screen.queryAllByText(/^wiederholung$/i).length).toBeLessThanOrEqual(1);
  }, 10000);

  it('keeps the next new card preview visible across blocked unlock boundaries', async () => {
    await renderReviewSession(2, {
      typedAnswerEnabled: false,
      prepareStore: ({ useLearningStore }) => {
        const [firstCard, secondCard] = Object.values(useLearningStore.getState().cards)
          .sort((left, right) => left.createdAt - right.createdAt);

        expect(firstCard).toBeTruthy();
        expect(secondCard).toBeTruthy();

        useLearningStore.setState((state) => ({
          ...state,
          cards: Object.fromEntries(
            Object.entries(state.cards).map(([cardId, card]) => {
              if (cardId === firstCard?.id || cardId === secondCard?.id) {
                return [
                  cardId,
                  {
                    ...card,
                    state: 'review',
                    dueAt: Date.now() - 60_000,
                    intervalDays: 2,
                    scheduledDays: 2,
                    reps: Math.max(card.reps, 1),
                    lastReviewedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
                    updatedAt: Date.now(),
                  },
                ];
              }

              return [cardId, card];
            }),
          ),
        }));
      },
    });

    expect(await screen.findByText(/nächste neue in 2 karten|naechste neue in 2 karten/i)).toBeInTheDocument();
  }, 10000);

  it('does not recompute deck scope revisions when an unrelated gate-rule update leaves deck data unchanged', async () => {
    const getCardRevisionSpy = vi.fn();
    const getNoteRevisionSpy = vi.fn();
    const getReviewLogRevisionSpy = vi.fn();

    const { useLearningStore } = await renderReviewSession(5, {
      applyMocks: () => {
        vi.doMock('@/modules/learning/sync/learningSyncMappers', async () => {
          const actual = await vi.importActual<typeof import('@/modules/learning/sync/learningSyncMappers')>(
            '@/modules/learning/sync/learningSyncMappers',
          );

          return {
            ...actual,
            getCardRevision: (card: Parameters<typeof actual.getCardRevision>[0]) => {
              getCardRevisionSpy();
              return actual.getCardRevision(card);
            },
            getNoteRevision: (note: Parameters<typeof actual.getNoteRevision>[0]) => {
              getNoteRevisionSpy();
              return actual.getNoteRevision(note);
            },
            getReviewLogRevision: (log: Parameters<typeof actual.getReviewLogRevision>[0]) => {
              getReviewLogRevisionSpy();
              return actual.getReviewLogRevision(log);
            },
          };
        });
      },
    });

    await screen.findByText(/house/i);

    expect(getNoteRevisionSpy).not.toHaveBeenCalled();
    expect(getReviewLogRevisionSpy).not.toHaveBeenCalled();

    const reviewedCardId = Object.values(useLearningStore.getState().cards)[0]?.id;
    expect(reviewedCardId).toBeTruthy();

    await act(async () => {
      useLearningStore.getState().submitReview(reviewedCardId!, 'good', true);
      await Promise.resolve();
    });

    expect(getNoteRevisionSpy).not.toHaveBeenCalled();

    const stabilizedCardRevisionCalls = getCardRevisionSpy.mock.calls.length;
    const stabilizedReviewLogRevisionCalls = getReviewLogRevisionSpy.mock.calls.length;

    act(() => {
      useLearningStore.getState().setGateRule({
        ...useLearningStore.getState().gateRule,
        typedAnswerEnabled: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zeigen/i })).toBeInTheDocument();
    });

    expect(getCardRevisionSpy.mock.calls.length).toBe(stabilizedCardRevisionCalls);
    expect(getNoteRevisionSpy).not.toHaveBeenCalled();
    expect(getReviewLogRevisionSpy.mock.calls.length).toBe(stabilizedReviewLogRevisionCalls);
  }, 10000);

  it('keeps a blocked learn flow in loading state while learning hydration is pending', async () => {
    vi.useFakeTimers();

    const { LearnReviewPage, useAppStore, useLearningStore } = await loadLearnReviewPage();

    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(false);
    vi.spyOn(useLearningStore.persist, 'onFinishHydration').mockImplementation((() => () => undefined) as never);

    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useLearningStore.getState().seedStarterDeck();

    const deckId = Object.values(useLearningStore.getState().decks)[0]?.id;
    expect(deckId).toBeTruthy();

    useLearningStore.getState().setGateRule({
      typedAnswerEnabled: false,
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });
    useLearningStore.getState().upsertAssignment('YouTube', 'app', deckId!, {
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          `/learn/review?targetId=YouTube&targetType=app&deckId=${deckId}&overlaySessionId=session-loading&unlockDurationMinutes=12&targetLabel=YouTube`,
        ]}
      >
        <Routes>
          <Route path="/learn/review" element={<LearnReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Freischaltung l(?:ä|ae)uft/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByText(/Freischaltung l(?:ä|ae)uft/i)).toBeInTheDocument();
    expect(screen.queryByText(/Learn-Freischaltung nicht bereit/i)).not.toBeInTheDocument();
  }, 10000);

  it('requires emotion selection before a completed learn session transitions to success', async () => {
    const { useAppStore } = await renderReviewSession(5, { targetId: null, typedAnswerEnabled: false });

    await advanceSessionToEmotionStep();
    expect(screen.queryByRole('button', { name: /zum dashboard/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /erleichtert/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 von max\. 3 gew(?:aehlt|ählt|Ã¤hlt)/i, { selector: 'p' })).toBeInTheDocument();
    });
    // Speicher-Button gibt es oben + unten — den ersten nehmen.
    fireEvent.click(screen.getAllByRole('button', { name: /abschlie/i })[0]);

    expect(await screen.findByRole('button', { name: /zum dashboard/i })).toBeInTheDocument();
    expect(useAppStore.getState().userProfile.commonEmotions.relieved).toBe(1);
    expect(useAppStore.getState().userProfile.recentInteractions[0]).toMatchObject({
      type: 'learning',
      emotions: ['relieved'],
      completed: true,
    });
    expect(useAppStore.getState().checkins[0]).toMatchObject({
      emotions: ['relieved'],
      reflection: 'Starter Vokabeln',
      breathingCompleted: false,
    });
  }, 20000);

  it('keeps direct learn sessions independent from the blocking answer count', async () => {
    await renderReviewSession(1, { targetId: null, typedAnswerEnabled: false });

    await waitFor(() => {
      expect(screen.getByText('1/5')).toBeInTheDocument();
    });
  }, 10000);

  it('uses a normalized target assignment deck when the blocked route has no deck id', async () => {
    await renderReviewSession(1, {
      targetId: 'YouTube',
      typedAnswerEnabled: false,
      includeDeckIdInRoute: false,
      prepareStore: ({ useLearningStore, deckId }) => {
        const state = useLearningStore.getState();
        const firstDeck = state.decks[deckId];
        const firstCard = Object.values(state.cards).find((card) => card.deckId === deckId);
        const firstNote = firstCard ? state.notes[firstCard.noteId] : undefined;
        expect(firstDeck).toBeTruthy();
        expect(firstCard).toBeTruthy();
        expect(firstNote).toBeTruthy();

        const assignedDeckId = 'deck-assigned-youtube';
        useLearningStore.setState((current) => ({
          ...current,
          decks: {
            ...current.decks,
            [assignedDeckId]: {
              ...firstDeck!,
              id: assignedDeckId,
              name: 'Assigned YouTube Deck',
            },
          },
          notes: {
            ...current.notes,
            'note-assigned-youtube': {
              ...firstNote!,
              id: 'note-assigned-youtube',
              deckId: assignedDeckId,
              front: 'Assigned YouTube Prompt',
              back: 'Assigned YouTube Answer',
            },
          },
          cards: {
            ...current.cards,
            'card-assigned-youtube': {
              ...firstCard!,
              id: 'card-assigned-youtube',
              noteId: 'note-assigned-youtube',
              deckId: assignedDeckId,
              createdAt: firstCard!.createdAt - 10,
              dueAt: Date.now() - 60_000,
            },
          },
        }));
        useLearningStore.getState().upsertAssignment('youtube', 'app', assignedDeckId, {
          sessionCreditsRequired: 1,
          unlockDurationMinutes: 99,
        });
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Assigned YouTube Prompt')).toBeInTheDocument();
    });
  }, 10000);

  it('does not rebootstrap a direct learn session after the first solved card', async () => {
    await renderReviewSession(1, { targetId: null, typedAnswerEnabled: false });

    await waitFor(() => {
      expect(screen.getByText('1/5')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^antwort zeigen$/i }));
    fireEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => {
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });
  }, 10000);

  it('reopens the blocked app after an overlay learn unlock finishes', async () => {
    await renderReviewSession(5, {
      typedAnswerEnabled: false,
      overlaySessionId: 'session-overlay',
    });

    await answerBlockedSessionToUnlock();
    // Der Block-Flow darf NIE hinter dem Emotions-Schritt hängen bleiben.
    expect(emotionPromptPresent()).toBe(false);

    await waitFor(() => {
      expect(primeNativeUnlockHandoffMock).toHaveBeenCalledWith('YouTube', 'app', 12);
      expect(flushLearningCloudSaveIfAvailableMock).toHaveBeenCalledWith('blocked-learn-unlock');
      expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1);
      expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app');
    }, { timeout: 10000 });
    expect(waitForPersistStorageIdleMock.mock.invocationCallOrder[0]).toBeLessThan(
      flushLearningCloudSaveIfAvailableMock.mock.invocationCallOrder[0],
    );
    expect(flushLearningCloudSaveIfAvailableMock.mock.invocationCallOrder[0]).toBeLessThan(
      dismissBlockingOverlayMock.mock.invocationCallOrder[0],
    );
    expect(primeNativeUnlockHandoffMock.mock.invocationCallOrder[0]).toBeLessThan(
      dismissBlockingOverlayMock.mock.invocationCallOrder[0],
    );
    expect(dismissBlockingOverlayMock.mock.invocationCallOrder[0]).toBeLessThan(
      openTargetMock.mock.invocationCallOrder[0],
    );
  }, 15000);

  it('stores blocked learn review timestamps before any deferred timer can run', async () => {
    const now = Date.UTC(2026, 3, 17, 12, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { useLearningStore } = await renderReviewSession(1, {
      typedAnswerEnabled: false,
      overlaySessionId: 'session-review-persist',
    });
    const firstCardId = Object.values(useLearningStore.getState().cards)
      .sort((left, right) => left.createdAt - right.createdAt)[0]?.id;
    expect(firstCardId).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: /^antwort zeigen$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /good/i }));

    const reviewedCard = useLearningStore.getState().cards[firstCardId!];
    expect(reviewedCard?.lastReviewedAt).toBe(now);
    expect(reviewedCard?.updatedAt).toBe(now);
    expect(Object.values(useLearningStore.getState().reviewLogs)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().reviewLogs)[0]).toMatchObject({
      cardId: firstCardId,
      reviewedAt: now,
      rating: 'good',
    });
  }, 10000);

  it('auto-unlocks a blocked learn overlay when the assigned deck has no eligible cards left', async () => {
    const now = Date.UTC(2026, 3, 16, 12, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { useAppStore } = await renderReviewSession(1, {
      typedAnswerEnabled: false,
      overlaySessionId: 'session-exhausted',
      prepareStore: ({ useLearningStore }) => {
        useLearningStore.setState((state) => ({
          ...state,
          cards: Object.fromEntries(
            Object.entries(state.cards).map(([cardId, card]) => [
              cardId,
              {
                ...card,
                state: 'review',
                dueAt: now + 3 * 24 * 60 * 60 * 1000,
                intervalDays: 3,
                scheduledDays: 3,
                reps: Math.max(card.reps, 1),
                lastReviewedAt: now - 60 * 60 * 1000,
                updatedAt: now,
              },
            ]),
          ),
        }));
      },
    });
    // Erschöpfter Block-Flow schaltet automatisch frei → Erfolgs-Screen, CTA "Zur App".
    fireEvent.click(await screen.findByRole('button', { name: /zur app/i }));
    await waitFor(() => {
      expect(primeNativeUnlockHandoffMock).toHaveBeenCalledWith('YouTube', 'app', 12);
      expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1);
      expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app');
    }, { timeout: 10000 });
    expect(useAppStore.getState().unlockedTargets['app:youtube']).toBe(now + 12 * 60 * 1000);
  }, 15000);

  it('dismisses the overlay and returns home when priming the unlock handoff fails', async () => {
    await renderReviewSession(5, {
      typedAnswerEnabled: false,
      overlaySessionId: 'session-prime-failure',
      applyMocks: () => {
        primeNativeUnlockHandoffMock.mockRejectedValueOnce(new Error('prime failed'));
      },
    });

    await answerBlockedSessionToUnlock();
    expect(emotionPromptPresent()).toBe(false);

    await waitFor(() => {
      expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1);
      expect(openTargetMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    }, { timeout: 10000 });
  }, 15000);

  it('anchors the typed-answer input when it receives focus', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    try {
      await renderReviewSession(1);

      fireEvent.focus(await screen.findByPlaceholderText('Antwort eingeben'));

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest',
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  }, 10000);

  it('keeps partial typed-answer feedback visible after manually revealing the answer', async () => {
    await renderReviewSession(10);

    // Ohne getippte Antwort ist nur Nochmal/Schwer erlaubt (Tip-Modus) — mit
    // "Schwer" durch die Setup-Karten zur Zielkarte vorrücken.
    for (let completedCards = 0; completedCards < 4; completedCards += 1) {
      fireEvent.click(await findRevealButton());
      fireEvent.click(await screen.findByRole('button', { name: /hard/i }));
    }

    expect(await screen.findByText('friend')).toBeInTheDocument();

    fireEvent.change(await screen.findByPlaceholderText('Antwort eingeben'), {
      target: { value: 'Freu' },
    });
    fireEvent.click(getCheckTypedAnswerButton());

    expect((await screen.findAllByText('Das war fast richtig.')).length).toBeGreaterThan(0);

    fireEvent.click(await findRevealButton());

    expect(await screen.findByText('Deine Eingabe: Freu')).toBeInTheDocument();

    // P2-E: Ein Beinahe-Treffer (partial, 3-Buchstaben-Tippmodus) sperrt
    // "Gut"/"Einfach" — nur Nochmal/Schwer, damit ein knapper Abruf kein langes
    // Easy-Intervall verdient.
    expect(await screen.findByRole('button', { name: /good/i })).toHaveAttribute('aria-disabled', 'true');
    expect(await screen.findByRole('button', { name: /easy/i })).toHaveAttribute('aria-disabled', 'true');
    expect(
      (await screen.findByRole('button', { name: /hard/i })).getAttribute('aria-disabled'),
    ).not.toBe('true');
  }, 15000);

  it('restores the original interval preview after going back to the previous solved card', async () => {
    await renderReviewSession(2, {
      typedAnswerEnabled: false,
      targetId: null,
    });

    fireEvent.click(await screen.findByRole('button', { name: /^antwort zeigen$/i }));
    const firstGoodPreview = screen.getByRole('button', { name: /good/i }).textContent;

    fireEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zurueck zur letzten karte/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /zurueck zur letzten karte/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /good/i }).textContent).toBe(firstGoodPreview);
    });
  }, 15000);

  it('redirects a blocked learn fallback to breathing while preserving the overlay session id', async () => {
    const { useLearningStore } = await renderReviewSession(2, {
      targetId: 'Instagram',
      overlaySessionId: 'session-fallback',
    });

    await act(async () => {
      useLearningStore.setState((state) => ({
        ...state,
        cards: {},
        decks: {},
      }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/Learn-Freischaltung nicht bereit/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /mit check-in fortfahren/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/breathing');
      expect(screen.getByTestId('location')).toHaveTextContent('overlaySessionId=session-fallback');
    });
  }, 10000);
});
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}
