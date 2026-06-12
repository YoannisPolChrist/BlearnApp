import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDevicePolicySnapshot } from '@/lib/nativePolicy';
import { commitLearningState } from '@/modules/modes/learningAssignments';
import { useLearningStore } from '@/store/useLearningStore';

describe('learning assignments', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('stores assignments separately for the same target id across target types', () => {
    useLearningStore.setState({
      decks: [
        {
          id: 'deck-app',
          name: 'App Deck',
          description: '',
          language: 'de',
          tags: [],
          cardIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'deck-website',
          name: 'Website Deck',
          description: '',
          language: 'de',
          tags: [],
          cardIds: [],
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });

    const store = useLearningStore.getState();
    store.upsertAssignment('instagram', 'app', 'deck-app');
    store.upsertAssignment('instagram', 'website', 'deck-website');

    expect(useLearningStore.getState().assignments).toHaveLength(2);
    expect(useLearningStore.getState().getAssignmentForTarget('instagram', 'app')?.deckId).toBe('deck-app');
    expect(useLearningStore.getState().getAssignmentForTarget('instagram', 'website')?.deckId).toBe('deck-website');
  });

  it('uses stable target-typed assignment ids for new assignments', () => {
    const store = useLearningStore.getState();
    store.upsertAssignment('Instagram', 'app', 'deck-app');
    store.upsertAssignment('Instagram', 'website', 'deck-website');

    const appAssignment = useLearningStore.getState().getAssignmentForTarget('Instagram', 'app');
    const websiteAssignment = useLearningStore.getState().getAssignmentForTarget('Instagram', 'website');

    expect(appAssignment?.id).toMatch(/^assignment_app_instagram_/);
    expect(websiteAssignment?.id).toMatch(/^assignment_website_instagram_/);
    expect(appAssignment?.id).not.toBe(websiteAssignment?.id);

    const firstId = appAssignment?.id;
    store.upsertAssignment('Instagram', 'app', 'deck-app-2');

    expect(useLearningStore.getState().getAssignmentForTarget('Instagram', 'app')?.id).toBe(firstId);
  });

  it('normalizes direct assignment target ids so native policy lookups keep the deck binding', () => {
    const store = useLearningStore.getState();
    store.upsertAssignment(' YouTube ', 'app', 'deck-app');

    const assignment = useLearningStore.getState().getAssignmentForTarget('youtube', 'app');
    expect(assignment?.targetId).toBe('youtube');
    expect(assignment?.deckId).toBe('deck-app');

    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: ['youtube'],
      blockedAppModes: { youtube: 'learn' },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: useLearningStore.getState().assignments,
      unlockedTargets: {},
    });

    expect(snapshot.targets[0]).toEqual(expect.objectContaining({
      id: 'youtube',
      type: 'app',
      mode: 'learn',
      deckId: 'deck-app',
    }));
  });

  it('removes only the requested target type assignment', () => {
    useLearningStore.setState({
      decks: [
        {
          id: 'deck-app',
          name: 'App Deck',
          description: '',
          language: 'de',
          tags: [],
          cardIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'deck-search',
          name: 'Search Deck',
          description: '',
          language: 'de',
          tags: [],
          cardIds: [],
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });

    const store = useLearningStore.getState();
    store.upsertAssignment('focus', 'app', 'deck-app');
    store.upsertAssignment('focus', 'search', 'deck-search');
    store.removeAssignment('focus', 'app');

    expect(useLearningStore.getState().getAssignmentForTarget('focus', 'app')).toBeUndefined();
    expect(useLearningStore.getState().getAssignmentForTarget('focus', 'search')?.deckId).toBe('deck-search');
  });

  it('keeps unlock grants isolated per target', () => {
    const store = useLearningStore.getState();

    store.registerUnlockGrant('instagram', 'app', 'deck-shared', 5, 15);
    store.registerUnlockGrant('youtube', 'app', 'deck-shared', 5, 15);

    expect(useLearningStore.getState().getUnlockGrant('instagram', 'app')).toBeDefined();
    expect(useLearningStore.getState().getUnlockGrant('youtube', 'app')).toBeDefined();
    expect(useLearningStore.getState().unlockGrants).toHaveLength(2);
  });

  it('normalizes unlock grant target ids and keeps target types isolated', () => {
    const store = useLearningStore.getState();

    store.registerUnlockGrant(' YouTube ', 'app', 'deck-shared', 5, 15);
    store.registerUnlockGrant(' youtube ', 'search', 'deck-shared', 5, 15);

    expect(useLearningStore.getState().getUnlockGrant('youtube', 'app')?.targetId).toBe('youtube');
    expect(useLearningStore.getState().getUnlockGrant('YOUTUBE', 'search')?.targetId).toBe('youtube');
    expect(useLearningStore.getState().unlockGrants).toHaveLength(2);
  });

  it('does not seed fallback vocab data before the learning store has hydrated', () => {
    const hasHydratedSpy = vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(false);
    try {
      commitLearningState({
        localActiveDeckId: undefined,
        setLocalActiveDeckId: vi.fn(),
        nextGateRule: {
          sessionCreditsRequired: 5,
          unlockDurationMinutes: 15,
        },
        nextDraftState: {
          blockedApps: ['com.google.android.youtube'],
          blockedAppModes: { 'com.google.android.youtube': 'learn' },
          blockedWebsites: [],
          blockedWebsiteModes: {},
          blockedSearchTerms: [],
          blockedSearchTermModes: {},
          blockSchedules: {},
        },
        blockedApps: [],
        blockedWebsites: [],
        blockedSearchTerms: [],
      });

      expect(Object.keys(useLearningStore.getState().decks)).toHaveLength(0);
      expect(useLearningStore.getState().assignments).toHaveLength(0);
    } finally {
      hasHydratedSpy.mockRestore();
    }
  });

  it('does not seed starter vocab during mode save when no learning deck exists', () => {
    const hasHydratedSpy = vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    try {
      commitLearningState({
        localActiveDeckId: undefined,
        setLocalActiveDeckId: vi.fn(),
        nextGateRule: {
          sessionCreditsRequired: 5,
          unlockDurationMinutes: 15,
        },
        nextDraftState: {
          blockedApps: ['com.google.android.youtube'],
          blockedAppModes: { 'com.google.android.youtube': 'learn' },
          blockedWebsites: [],
          blockedWebsiteModes: {},
          blockedSearchTerms: [],
          blockedSearchTermModes: {},
          blockSchedules: {},
        },
        blockedApps: [],
        blockedWebsites: [],
        blockedSearchTerms: [],
      });

      expect(Object.keys(useLearningStore.getState().decks)).toHaveLength(0);
      expect(useLearningStore.getState().activeDeckId).toBeUndefined();
      expect(useLearningStore.getState().assignments).toHaveLength(0);
    } finally {
      hasHydratedSpy.mockRestore();
    }
  });

  it('creates stable assignment ids when mode save adds learn targets', () => {
    const hasHydratedSpy = vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    try {
      useLearningStore.setState({
        activeDeckId: 'deck-focus',
        decks: {
          'deck-focus': {
            id: 'deck-focus',
            name: 'Focus Deck',
            description: '',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 1,
            updatedAt: 1,
          },
        },
      });

      commitLearningState({
        localActiveDeckId: undefined,
        setLocalActiveDeckId: vi.fn(),
        nextGateRule: {
          sessionCreditsRequired: 5,
          unlockDurationMinutes: 15,
        },
        nextDraftState: {
          blockedApps: ['com.google.android.youtube'],
          blockedAppModes: { 'com.google.android.youtube': 'learn' },
          blockedWebsites: [],
          blockedWebsiteModes: {},
          blockedSearchTerms: [],
          blockedSearchTermModes: {},
          blockSchedules: {},
        },
        blockedApps: [],
        blockedWebsites: [],
        blockedSearchTerms: [],
      });

      expect(useLearningStore.getState().assignments[0]?.id).toMatch(
        /^assignment_app_com_google_android_youtube_/,
      );
    } finally {
      hasHydratedSpy.mockRestore();
    }
  });
});
