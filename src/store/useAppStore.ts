import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  AppState,
  BreathingPattern,
  Challenge,
  EmotionCategory,
} from '@/store/appStore.types';
import {
  APP_STORE_PERSIST_KEY,
  APP_STORE_PERSIST_VERSION,
  appStoreStorage,
  buildPersistedAppState,
  mergePersistedAppState,
  migratePersistedAppState,
} from '@/store/appStore.shared';
import {
  createBlockingSlice,
  createEngagementSlice,
  createModeSlice,
  createPenaltySlice,
  createPreferencesSlice,
} from '@/store/appStore.slices';

export type {
  AccountabilityPartner,
  AlbyConnectionTestState,
  AppLanguage,
  BreathPhase,
  BlockingMode,
  CheckinEntry,
  DailyStats,
  Emotion,
  LastModeActivationSnapshot,
  NativeRuntimeIssueKey,
  NotificationPreferences,
  PenaltyChargeResult,
  PenaltyTransaction,
  SavedModeSelection,
  UserInteraction,
  UserProfile,
} from '@/store/appStore.types';
export { isVerifiedAccountabilityPartner } from '@/store/appStore.types';

// --- Constants --------------------------------------------------------------

export const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    id: 'box',
    name: 'Box-Atmung',
    description: '4 Sekunden einatmen, halten, ausatmen, Pause',
    phases: [
      { type: 'inhale', duration: 4, instruction: 'Einatmen...' },
      { type: 'hold', duration: 4, instruction: 'Halten...' },
      { type: 'exhale', duration: 4, instruction: 'Ausatmen...' },
      { type: 'rest', duration: 4, instruction: 'Pause...' },
    ],
    totalCycles: 5,
  },
  {
    id: '478',
    name: '4-7-8 Entspannung',
    description: 'Beruhigende Atemtechnik f\u00fcr tiefe Entspannung',
    phases: [
      { type: 'inhale', duration: 4, instruction: 'Tief einatmen...' },
      { type: 'hold', duration: 7, instruction: 'Sanft halten...' },
      { type: 'exhale', duration: 8, instruction: 'Langsam ausatmen...' },
    ],
    totalCycles: 5,
  },
  {
    id: 'simple',
    name: 'Bewusstes Atmen',
    description: 'Einfache tiefe Atemz\u00fcge',
    phases: [
      { type: 'inhale', duration: 4, instruction: 'Einatmen...' },
      { type: 'exhale', duration: 6, instruction: 'Ausatmen...' },
    ],
    totalCycles: 8,
  },
];

export const EMOTION_CATEGORIES: EmotionCategory[] = [
  {
    id: 'positiv',
    label: 'Positiv',
    color: '#7C5CFA',
    emotions: [
      { id: 'relieved', emoji: '\u{1F60C}', label: 'Erleichtert' },
      { id: 'content', emoji: '\u{1F642}', label: 'Zufrieden' },
      { id: 'connected', emoji: '\u{1F91D}', label: 'Verbunden' },
      { id: 'optimistic', emoji: '\u{1F324}\uFE0F', label: 'Optimistisch' },
      { id: 'centered', emoji: '\u{1F9D8}', label: 'Zentriert' },
      { id: 'happy', emoji: '\u{1F60A}', label: 'Gl\u00fccklich' },
      { id: 'relaxed', emoji: '\u{1F60C}', label: 'Entspannt' },
      { id: 'grateful', emoji: '\u{1F64F}', label: 'Dankbar' },
      { id: 'motivated', emoji: '\u{1F525}', label: 'Motiviert' },
      { id: 'excited', emoji: '\u{1F929}', label: 'Begeistert' },
      { id: 'proud', emoji: '\u{1F4AA}', label: 'Stolz' },
      { id: 'peaceful', emoji: '\u{1F54A}\uFE0F', label: 'Friedlich' },
      { id: 'inspired', emoji: '\u2728', label: 'Inspiriert' },
      { id: 'hopeful', emoji: '\u{1F31F}', label: 'Hoffnungsvoll' },
      { id: 'loving', emoji: '\u{1F970}', label: 'Liebevoll' },
      { id: 'confident', emoji: '\u{1F60E}', label: 'Selbstbewusst' },
      { id: 'joyful', emoji: '\u{1F389}', label: 'Fr\u00f6hlich' },
      { id: 'safe', emoji: '\u{1FAF6}', label: 'Geborgen' },
      { id: 'light', emoji: '\u{1F308}', label: 'Leicht' },
      { id: 'curious_hopeful', emoji: '\u{1F4AB}', label: 'Zuversichtlich' },
      { id: 'seen', emoji: '\u{1F49E}', label: 'Gesehen' },
      { id: 'open', emoji: '\u{1FAB7}', label: 'Offen' },
      { id: 'serene', emoji: '\u{1F31E}', label: 'Gelassen' },
      { id: 'fulfilled', emoji: '\u{1F60A}', label: 'Erfüllt' },
      { id: 'playful', emoji: '\u{1F643}', label: 'Verspielt' },
    ],
  },
  {
    id: 'neutral',
    label: 'Neutral',
    color: '#8B72FF',
    emotions: [
      { id: 'focused', emoji: '\u{1F3AF}', label: 'Fokussiert' },
      { id: 'alert', emoji: '\u{1F440}', label: 'Wach' },
      { id: 'present', emoji: '\u{1F33F}', label: 'Pr\u00e4sent' },
      { id: 'uncertain', emoji: '\u{1F937}', label: 'Unsicher' },
      { id: 'observing', emoji: '\u{1FA9E}', label: 'Beobachtend' },
      { id: 'calm', emoji: '\u{1F610}', label: 'Ruhig' },
      { id: 'bored', emoji: '\u{1F971}', label: 'Gelangweilt' },
      { id: 'tired', emoji: '\u{1F634}', label: 'M\u00fcde' },
      { id: 'thoughtful', emoji: '\u{1F914}', label: 'Nachdenklich' },
      { id: 'curious', emoji: '\u{1F9D0}', label: 'Neugierig' },
      { id: 'indifferent', emoji: '\u{1F611}', label: 'Gleichg\u00fcltig' },
      { id: 'distracted', emoji: '\u{1FAE0}', label: 'Abgelenkt' },
      { id: 'restless', emoji: '\u{1F62C}', label: 'Unruhig' },
      { id: 'hesitant', emoji: '\u{1FAE4}', label: 'Z\u00f6gerlich' },
      { id: 'busy', emoji: '\u{1F4DA}', label: 'Besch\u00e4ftigt' },
      { id: 'guarded', emoji: '\u{1F6E1}\uFE0F', label: 'Vorsichtig' },
      { id: 'grounded', emoji: '\u{1FAA8}', label: 'Geerdet' },
      { id: 'numb', emoji: '\u{1FAE5}', label: 'Taub' },
      { id: 'reflective', emoji: '\u{1F4AD}', label: 'Reflektierend' },
      { id: 'waiting', emoji: '\u{1F567}', label: 'Abwartend' },
    ],
  },
  {
    id: 'negativ',
    label: 'Negativ',
    color: '#6E49E6',
    emotions: [
      { id: 'worried', emoji: '\u{1F61F}', label: 'Besorgt' },
      { id: 'drained', emoji: '\u{1FAE5}', label: 'Ausgelaugt' },
      { id: 'irritated', emoji: '\u{1F612}', label: 'Genervt' },
      { id: 'ashamed', emoji: '\u{1F633}', label: 'Besch\u00e4mt' },
      { id: 'disappointed', emoji: '\u{1F61E}', label: 'Entt\u00e4uscht' },
      { id: 'stressed', emoji: '\u{1F630}', label: 'Gestresst' },
      { id: 'anxious', emoji: '\u{1F61F}', label: '\u00c4ngstlich' },
      { id: 'sad', emoji: '\u{1F622}', label: 'Traurig' },
      { id: 'frustrated', emoji: '\u{1F624}', label: 'Frustriert' },
      { id: 'lonely', emoji: '\u{1F97A}', label: 'Einsam' },
      { id: 'overwhelmed', emoji: '\u{1F92F}', label: '\u00dcberfordert' },
      { id: 'angry', emoji: '\u{1F621}', label: 'W\u00fctend' },
      { id: 'guilty', emoji: '\u{1F614}', label: 'Schuldig' },
      { id: 'hurt', emoji: '\u{1F494}', label: 'Verletzt' },
      { id: 'tense', emoji: '\u{1FAE8}', label: 'Angespannt' },
      { id: 'discouraged', emoji: '\u{1F940}', label: 'Entmutigt' },
      { id: 'jealous', emoji: '\u{1F636}\u200D\u{1F32B}\uFE0F', label: 'Neidisch' },
      { id: 'pressured', emoji: '\u23F3', label: 'Unter Druck' },
      { id: 'insecure', emoji: '\u{1F628}', label: 'Verunsichert' },
      { id: 'restless_neg', emoji: '\u{1F615}', label: 'Rastlos' },
    ],
  },
  {
    id: 'koerper',
    label: 'Koerper',
    color: '#9A83FF',
    emotions: [
      { id: 'energized', emoji: '\u26A1', label: 'Energiegeladen' },
      { id: 'heavy', emoji: '\u{1FAAB}', label: 'Schwer' },
      { id: 'shaky', emoji: '\u{1FAE8}', label: 'Zittrig' },
      { id: 'awake', emoji: '\u2600\uFE0F', label: 'Hellwach' },
      { id: 'foggy', emoji: '\u{1F32B}\uFE0F', label: 'Benebelt' },
      { id: 'warm', emoji: '\u{1F9E3}', label: 'Warm' },
      { id: 'tight', emoji: '\u{1FAA2}', label: 'Verkrampft' },
      { id: 'rested', emoji: '\u{1F6CC}', label: 'Erholt' },
      { id: 'sensitive', emoji: '\u{1FAE7}', label: 'Empfindlich' },
      { id: 'regulated', emoji: '\u{1F486}', label: 'Reguliert' },
    ],
  },
];

export const CHALLENGES: Challenge[] = [
  {
    id: 'stretch',
    name: 'Dehnung',
    description: 'Stehe auf und dehne dich 30 Sekunden lang.',
    instruction: 'Strecke deine Arme \u00fcber den Kopf und halte die Position.',
    icon: '\u{1F9D8}',
    duration: 30,
    difficulty: 'easy',
  },
  {
    id: 'water',
    name: 'Wasser trinken',
    description: 'Trinke ein Glas Wasser bewusst.',
    instruction: 'Nimm langsame, bewusste Schlucke.',
    icon: '\u{1F4A7}',
    duration: 20,
    difficulty: 'easy',
  },
  {
    id: 'window',
    name: 'Fenster-Blick',
    description: 'Schaue 30 Sekunden aus dem Fenster.',
    instruction: 'Beobachte die Umgebung - Farben, Bewegungen, Licht.',
    icon: '\u{1FA9F}',
    duration: 30,
    difficulty: 'easy',
  },
  {
    id: 'breathing_deep',
    name: 'Tiefes Atmen',
    description: '5 tiefe Atemz\u00fcge - bewusst und langsam.',
    instruction: '4 Sekunden einatmen, 4 halten, 8 ausatmen.',
    icon: '\u{1F32C}\uFE0F',
    duration: 45,
    difficulty: 'medium',
  },
  {
    id: 'gratitude',
    name: 'Dankbarkeit',
    description: 'Nenne 3 Dinge, f\u00fcr die du gerade dankbar bist.',
    instruction: 'Denke bewusst an 3 positive Dinge in deinem Leben.',
    icon: '\u{1F64F}',
    duration: 40,
    difficulty: 'medium',
  },
  {
    id: 'body_scan',
    name: 'Body Scan',
    description: 'Scanne deinen K\u00f6rper von Kopf bis Fu\u00df.',
    instruction: 'Sp\u00fcre Anspannung und lass sie los.',
    icon: '\u{1F9E0}',
    duration: 60,
    difficulty: 'hard',
  },
  {
    id: 'cold_water',
    name: 'Kaltes Wasser',
    description: 'Halte deine H\u00e4nde unter kaltes Wasser.',
    instruction: 'Sp\u00fcre die K\u00e4lte bewusst und bleibe pr\u00e4sent.',
    icon: '\u{1F9CA}',
    duration: 30,
    difficulty: 'medium',
  },
  {
    id: 'walk',
    name: 'Mini-Spaziergang',
    description: 'Gehe 1 Minute im Raum umher.',
    instruction: 'Sp\u00fcre jeden Schritt bewusst.',
    icon: '\u{1F6B6}',
    duration: 60,
    difficulty: 'hard',
  },
];

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (...args) =>
        ({
          ...createModeSlice(...args),
          ...createEngagementSlice(...args),
          ...createBlockingSlice(...args),
          ...createPreferencesSlice(...args),
          ...createPenaltySlice(...args),
        }) as AppState,
      {
        name: APP_STORE_PERSIST_KEY,
        storage: appStoreStorage,
        version: APP_STORE_PERSIST_VERSION,
        migrate: migratePersistedAppState,
        merge: (persistedState, currentState) =>
          mergePersistedAppState(persistedState, currentState as AppState),
        partialize: (state) => buildPersistedAppState(state),
      },
    ),
  ),
);

useAppStore.persist.onHydrate(() => {
  useAppStore.setState({ hasHydrated: false });
});

useAppStore.persist.onFinishHydration(() => {
  useAppStore.setState({ hasHydrated: true });
});

if (useAppStore.persist.hasHydrated()) {
  useAppStore.setState({ hasHydrated: true });
}

// --- Helper: Get random challenge ------------------------------------------

export function getRandomChallenge(level: number = 1): Challenge {
  let pool: Challenge[];
  if (level <= 2) pool = CHALLENGES.filter((c) => c.difficulty === 'easy');
  else if (level <= 4) pool = CHALLENGES.filter((c) => c.difficulty !== 'hard');
  else pool = CHALLENGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}
