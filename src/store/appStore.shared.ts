import type { StateCreator } from 'zustand';
import {
  type AlbyConnectionTestResult,
  normalizeLightningAddress,
} from '@/services/albyWalletService';
import { getLocalDateKey } from '@/lib/localDate';
import {
  DEFAULT_APP_LANGUAGE,
  normalizeInstalledLanguagePacks,
} from '@/lib/languages';
import {
  createDefaultStrictAddonMap,
  deriveActiveModes,
  getPrimaryActiveMode,
  getTargetMode as getAssignedTargetMode,
  isStrictAddonModeId,
  normalizeTargetValue,
  setTargetModeRecord,
  STRICT_ADDON_MODE_IDS,
  type StrictAddonMap,
  type StrictAddonState,
  type TargetModeCollections,
  type TargetModeId,
} from '@/lib/targetModes';
import { deriveEffectiveTargetModeCollections } from '@/lib/effectiveBlockingTargets';
import {
  isPenaltyAmountConfigured,
  isPenaltyRuntimeActive,
  isPenaltySetupReady,
} from '@/lib/penaltyRuntime';
import { createQuotaResilientJsonStorage, waitForPersistStorageIdle } from '@/lib/persistStorage';
import { resolveUnlockedTargets } from '@/lib/unlockedTargets';
import type {
  AccountabilityPartner,
  ActiveMode,
  AlbyConnectionTestState,
  AppLanguage,
  AppState,
  CheckinEntry,
  NativeRuntimeIssueKey,
  NotificationPreferences,
  PenaltyTransaction,
  SavedModeSelection,
  UserProfile,
} from '@/store/appStore.types';

export type AppStoreSlice<T> = StateCreator<AppState, [], [], T>;

const MAX_RECENT = 50;
const MAX_PERSISTED_CHECKINS = 100;
const MAX_PERSISTED_CHECKIN_CHAT_MESSAGES = 6;
const MAX_PERSISTED_USER_INTERACTIONS = 12;
const MAX_PERSISTED_COMPLETED_CHALLENGES = 48;
const MAX_PERSISTED_PENALTY_TRANSACTIONS = 60;

export const defaultProfile: UserProfile = {
  commonEmotions: {},
  triggerTimes: [],
  recentInteractions: [],
  totalSessions: 0,
  totalChallengesCompleted: 0,
  consecutiveDays: 0,
  completedChallenges: [],
};

export const defaultNotificationPreferences: NotificationPreferences = {
  reminders: true,
  statusHints: true,
  learnProgress: true,
  penaltyAlerts: true,
};
export const APP_STORE_PERSIST_KEY = 'mindful-usage-storage';
export const APP_STORE_PERSIST_VERSION = 1;

export function getToday() {
  return getLocalDateKey(new Date());
}

export function normalizeAccountabilityPartner(
  partner: AccountabilityPartner | null | undefined,
): AccountabilityPartner | null {
  if (!partner) return null;

  return {
    ...partner,
    normalizedLightningAddress:
      partner.normalizedLightningAddress || normalizeLightningAddress(partner.lightningAddress),
    validationStatus: partner.validationStatus || 'unverified',
    validationMessage: partner.validationMessage,
    validatedAt: partner.validatedAt,
  };
}

export function createIdleAlbyConnectionTestState(): AlbyConnectionTestState {
  return {
    status: 'idle',
  };
}

export function getPenaltyTransactionAmountSats(transaction: PenaltyTransaction): number {
  return typeof transaction.amountSats === 'number' && Number.isFinite(transaction.amountSats)
    ? transaction.amountSats
    : 0;
}

export function toPenaltyBlockType(blockType: string): 'app' | 'website' | 'search' {
  return blockType === 'website' || blockType === 'search' ? blockType : 'app';
}

export function getPenaltyBlockLabel(blockType: 'app' | 'website' | 'search'): string {
  if (blockType === 'website') return 'Website';
  if (blockType === 'search') return 'Suchbegriff';
  return 'App';
}

export function createPenaltyTransactionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function mapAlbyConnectionTestResult(result: AlbyConnectionTestResult): AlbyConnectionTestState {
  if (!result.success) {
    return {
      status: 'failed',
      testedAt: result.testedAt,
      lastError: result.error,
    };
  }

  return {
    status: 'passed',
    testedAt: result.testedAt,
    walletAlias: result.walletAlias,
    walletLightningAddress: result.walletLightningAddress,
    balanceSats: result.balanceSats,
    budgetTotalSats: result.budgetTotalSats ?? null,
    budgetUsedSats: result.budgetUsedSats ?? null,
    budgetRemainingSats: result.budgetRemainingSats ?? null,
    budgetRenewsAt: result.budgetRenewsAt ?? null,
    budgetRenewal: result.budgetRenewal ?? null,
    lastError: undefined,
  };
}

export function normalizePenaltyTransactions(transactions: unknown): PenaltyTransaction[] {
  if (!Array.isArray(transactions)) return [];

  return transactions
    .filter((transaction): transaction is Partial<PenaltyTransaction> => Boolean(transaction && typeof transaction === 'object'))
    .map((transaction) => {
      const isPenalty = transaction.type === 'penalty';
      const deliveryStatus = transaction.deliveryStatus === 'sent' || transaction.deliveryStatus === 'failed'
        ? transaction.deliveryStatus
        : transaction.deliveryStatus === 'processing'
          ? 'processing'
          : undefined;

      return {
        ...transaction,
        amountSats: typeof transaction.amountSats === 'number' ? Math.round(transaction.amountSats) : undefined,
        sentAt: typeof transaction.sentAt === 'number'
          ? transaction.sentAt
          : typeof transaction.deliveredAt === 'number'
            ? transaction.deliveredAt
            : undefined,
        deliveryStatus,
        lastDeliveryError:
          isPenalty && transaction.deliveryStatus === 'pending'
            ? transaction.lastDeliveryError || 'Legacy-Strafzahlung muss nach dem Update erneut ausgeloest werden.'
            : transaction.lastDeliveryError,
      } as PenaltyTransaction;
    });
}

export function normalizeAlbyConnectionTestState(value: unknown): AlbyConnectionTestState {
  if (!value || typeof value !== 'object') {
    return createIdleAlbyConnectionTestState();
  }

  const candidate = value as Partial<AlbyConnectionTestState>;
  const status = candidate.status;

  if (status !== 'idle' && status !== 'testing' && status !== 'passed' && status !== 'failed') {
    return createIdleAlbyConnectionTestState();
  }

  return {
    status,
    testedAt: typeof candidate.testedAt === 'number' ? candidate.testedAt : undefined,
    walletAlias: typeof candidate.walletAlias === 'string' ? candidate.walletAlias : undefined,
    walletLightningAddress: typeof candidate.walletLightningAddress === 'string' ? candidate.walletLightningAddress : undefined,
    balanceSats: typeof candidate.balanceSats === 'number' ? candidate.balanceSats : undefined,
    budgetTotalSats: typeof candidate.budgetTotalSats === 'number' ? candidate.budgetTotalSats : null,
    budgetUsedSats: typeof candidate.budgetUsedSats === 'number' ? candidate.budgetUsedSats : null,
    budgetRemainingSats: typeof candidate.budgetRemainingSats === 'number' ? candidate.budgetRemainingSats : null,
    budgetRenewsAt: typeof candidate.budgetRenewsAt === 'number' ? candidate.budgetRenewsAt : null,
    budgetRenewal: typeof candidate.budgetRenewal === 'string' ? candidate.budgetRenewal : null,
    lastError: typeof candidate.lastError === 'string' ? candidate.lastError : undefined,
  };
}

export function getModeCollections(
  state: Pick<AppState, 'blockedAppModes' | 'blockedWebsiteModes' | 'blockedSearchTermModes'>,
): TargetModeCollections {
  return {
    blockedAppModes: state.blockedAppModes,
    blockedWebsiteModes: state.blockedWebsiteModes,
    blockedSearchTermModes: state.blockedSearchTermModes,
  };
}

function areModesEqual(left: AppState['activeModes'], right: AppState['activeModes']): boolean {
  if (left.length !== right.length) return false;
  return left.every((mode, index) => mode === right[index]);
}

export function normalizeTargetIds<T extends 'app' | 'website' | 'search'>(
  targetType: T,
  values: string[],
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeTargetValue(targetType, value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function normalizeTargetModeRecord<T extends 'app' | 'website' | 'search'>(
  targetType: T,
  record: Record<string, TargetModeId>,
): Record<string, TargetModeId> {
  return Object.fromEntries(
    Object.entries(record)
      .map(([targetId, nextMode]) => [normalizeTargetValue(targetType, targetId), nextMode] as const)
      .filter((entry): entry is readonly [string, TargetModeId] => Boolean(entry[0] && entry[1])),
  );
}

export function normalizeBlockSchedules(
  blockSchedules: Record<string, { from: string; to: string }>,
  allowedApps: string[],
): Record<string, { from: string; to: string }> {
  const allowedAppSet = new Set(allowedApps);

  return Object.fromEntries(
    Object.entries(blockSchedules)
      .map(([targetId, schedule]) => {
        const normalizedTargetId = normalizeTargetValue('app', targetId);
        const normalizedSchedule =
          schedule && typeof schedule.from === 'string' && typeof schedule.to === 'string'
            ? { from: schedule.from.trim(), to: schedule.to.trim() }
            : null;

        return [normalizedTargetId, normalizedSchedule] as const;
      })
      .filter(
        (entry): entry is readonly [string, { from: string; to: string }] =>
          Boolean(entry[0] && allowedAppSet.has(entry[0]) && entry[1]?.from && entry[1]?.to),
      ),
  );
}

function normalizeStrictAddonState(value: unknown): StrictAddonState {
  if (!value || typeof value !== 'object') {
    return createDefaultStrictAddonMap().strict;
  }

  const candidate = value as Partial<StrictAddonState>;
  return {
    enabled: candidate.enabled === true,
    startTime: typeof candidate.startTime === 'string' ? candidate.startTime.trim() : '08:00',
    endTime: typeof candidate.endTime === 'string' ? candidate.endTime.trim() : '17:00',
    lockUntil: typeof candidate.lockUntil === 'number' ? candidate.lockUntil : null,
    lockedAppIds: Array.isArray(candidate.lockedAppIds)
      ? candidate.lockedAppIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [],
  };
}

export function normalizeStrictAddons(value: unknown): StrictAddonMap {
  if (!value || typeof value !== 'object') {
    return createDefaultStrictAddonMap();
  }

  const raw = value as Record<string, unknown>;
  const next = createDefaultStrictAddonMap();
  STRICT_ADDON_MODE_IDS.forEach((mode) => {
    if (mode in raw) {
      next[mode] = normalizeStrictAddonState(raw[mode]);
    }
  });
  return next;
}

function migrateLegacyStrictAddons(options: {
  strictAddons?: StrictAddonMap | null;
  strictCompanionModes?: Record<string, unknown> | null;
  strictStartTime?: string | null;
  strictEndTime?: string | null;
}): StrictAddonMap {
  if (options.strictAddons) {
    return normalizeStrictAddons(options.strictAddons);
  }

  const fallback = createDefaultStrictAddonMap({
    strict: {
      startTime: options.strictStartTime ?? '08:00',
      endTime: options.strictEndTime ?? '17:00',
    },
    learn: {
      startTime: options.strictStartTime ?? '08:00',
      endTime: options.strictEndTime ?? '17:00',
    },
    penalty: {
      startTime: options.strictStartTime ?? '08:00',
      endTime: options.strictEndTime ?? '17:00',
    },
  });
  const legacy = options.strictCompanionModes ?? {};
  Object.entries(legacy).forEach(([mode, enabled]) => {
    if (!isStrictAddonModeId(mode)) return;
    if (enabled !== true) return;
    fallback[mode] = {
      ...fallback[mode],
      enabled: true,
    };
  });
  return fallback;
}

function prioritizeSavedMode(
  activeModes: AppState['activeModes'],
  savedModeSelection: SavedModeSelection | null,
): AppState['activeModes'] {
  if (!savedModeSelection || savedModeSelection === 'normal' || !activeModes.includes(savedModeSelection)) {
    return activeModes;
  }

  const hasLock = activeModes.includes('lock');
  const remainingModes = activeModes.filter((mode) => mode !== 'lock' && mode !== savedModeSelection);

  return hasLock
    ? ['lock', savedModeSelection, ...remainingModes]
    : [savedModeSelection, ...remainingModes];
}

export function buildDerivedModeState(
  state: Pick<
    AppState,
    | 'blockedAppModes'
    | 'blockedWebsiteModes'
    | 'blockedSearchTermModes'
    | 'strictLockUntil'
    | 'lastModeActivation'
    | 'savedModeSelection'
    | 'strictAddons'
    | 'penaltyEnabled'
    | 'penaltyAmountSats'
    | 'accountabilityPartner'
    | 'albyConnection'
    | 'albyConnectionTest'
  >,
  now = Date.now(),
) {
  const effectiveModeCollections = deriveEffectiveTargetModeCollections({
    ...getModeCollections(state),
    penaltyRuntimeActive: isPenaltyRuntimeActive(state),
  });
  const activeModes = prioritizeSavedMode(
    deriveActiveModes({
      ...effectiveModeCollections,
      strictAddons: state.strictAddons,
      strictLockUntil: state.strictLockUntil,
      now,
    }),
    state.savedModeSelection,
  );

  return {
    activeModes,
    activeMode: getPrimaryActiveMode(activeModes) as ActiveMode,
    lastModeActivation: activeModes.length > 0
      ? {
          modes: activeModes,
          activatedAt:
            state.lastModeActivation && areModesEqual(state.lastModeActivation.modes, activeModes)
              ? state.lastModeActivation.activatedAt
              : now,
        }
      : null,
  };
}

export function applyModeState<T extends Partial<AppState>>(
  state: AppState,
  partial: T,
  now = Date.now(),
): T & Pick<AppState, 'activeMode' | 'activeModes' | 'lastModeActivation'> {
  const nextState = {
    ...state,
    ...partial,
  } as AppState;

  return {
    ...partial,
    ...buildDerivedModeState(nextState, now),
  };
}

export function buildLegacyModeMaps(
  blockedApps: string[],
  blockedWebsites: string[],
  blockedSearchTerms: string[],
  mode: ActiveMode,
) {
  if (mode !== 'strict' && mode !== 'learn' && mode !== 'penalty') {
    return {
      blockedAppModes: {} as Record<string, TargetModeId>,
      blockedWebsiteModes: {} as Record<string, TargetModeId>,
      blockedSearchTermModes: {} as Record<string, TargetModeId>,
    };
  }

  const nextMode = mode as TargetModeId;

  return {
    blockedAppModes: Object.fromEntries(normalizeTargetIds('app', blockedApps).map((app) => [app, nextMode])),
    blockedWebsiteModes: Object.fromEntries(normalizeTargetIds('website', blockedWebsites).map((website) => [website, nextMode])),
    blockedSearchTermModes: Object.fromEntries(normalizeTargetIds('search', blockedSearchTerms).map((term) => [term, nextMode])),
  };
}

function buildPersistedUserProfile(profile: UserProfile | null | undefined): UserProfile {
  const safeProfile = profile ?? defaultProfile;
  return {
    ...safeProfile,
    recentInteractions: (safeProfile.recentInteractions ?? []).slice(0, MAX_PERSISTED_USER_INTERACTIONS).map((interaction) => ({
      ...interaction,
      emotions: interaction.emotions ? [...interaction.emotions] : undefined,
    })),
    triggerTimes: (safeProfile.triggerTimes ?? []).slice(-24),
    completedChallenges: (safeProfile.completedChallenges ?? []).slice(-MAX_PERSISTED_COMPLETED_CHALLENGES),
  };
}

function buildPersistedCheckins(checkins: CheckinEntry[] | null | undefined): CheckinEntry[] {
  return (checkins ?? []).slice(0, MAX_PERSISTED_CHECKINS).map((entry) => ({
    ...entry,
    emotions: Array.isArray(entry.emotions) ? [...entry.emotions] : [],
    chatHistory: entry.chatHistory
      .slice(-MAX_PERSISTED_CHECKIN_CHAT_MESSAGES)
      .map((message) => ({ ...message })),
  }));
}

function buildPersistedPenaltyTransactions(transactions: PenaltyTransaction[] | null | undefined): PenaltyTransaction[] {
  return (transactions ?? []).slice(0, MAX_PERSISTED_PENALTY_TRANSACTIONS).map((transaction) => ({ ...transaction }));
}

export function buildPersistedAppState(state: AppState) {
  return {
    savedModeSelection: state.savedModeSelection,
    strictAddons: state.strictAddons,
    blockingMode: state.blockingMode,
    strictStartTime: state.strictStartTime,
    strictEndTime: state.strictEndTime,
    breathingRounds: state.breathingRounds,
    interventionInterval: state.interventionInterval,
    defaultUnlockDurationMinutes: state.defaultUnlockDurationMinutes,
    modeProtection: state.modeProtection,
    strictLockUntil: state.strictLockUntil,
    strictLockScope: state.strictLockScope,
    dailyStats: state.dailyStats,
    userProfile: buildPersistedUserProfile(state.userProfile),
    checkins: buildPersistedCheckins(state.checkins),
    selectedPattern: state.selectedPattern,
    streak: state.streak,
    lastCheckinDate: state.lastCheckinDate,
    blockedApps: state.blockedApps ?? [],
    blockedAppModes: state.blockedAppModes,
    blockedWebsites: state.blockedWebsites ?? [],
    blockedWebsiteModes: state.blockedWebsiteModes,
    blockedSearchTerms: state.blockedSearchTerms ?? [],
    blockedSearchTermModes: state.blockedSearchTermModes,
    interventionPatternId: state.interventionPatternId,
    unlockedTargets: state.unlockedTargets,
    blockSchedules: state.blockSchedules,
    appLanguage: state.appLanguage,
    installedAppLanguagePacks: state.installedAppLanguagePacks ?? [],
    notificationsEnabled: state.notificationsEnabled,
    notificationPreferences: state.notificationPreferences ?? defaultNotificationPreferences,
    notificationPermissionPromptSeen: state.notificationPermissionPromptSeen ?? false,
    appIntroSeen: state.appIntroSeen,
    penaltyAmountSats: state.penaltyAmountSats,
    penaltyEnabled: state.penaltyEnabled,
    penaltyTransactions: buildPersistedPenaltyTransactions(state.penaltyTransactions),
    accountabilityPartner: state.accountabilityPartner,
    albyConnection: state.albyConnection,
    albyConnectionTest: state.albyConnectionTest,
  };
}

type PersistedAppState = ReturnType<typeof buildPersistedAppState>;

function buildBlockingRuntimeResetState(): Pick<
  PersistedAppState,
  | 'savedModeSelection'
  | 'strictAddons'
  | 'strictLockUntil'
  | 'strictLockScope'
  | 'blockedApps'
  | 'blockedAppModes'
  | 'blockedWebsites'
  | 'blockedWebsiteModes'
  | 'blockedSearchTerms'
  | 'blockedSearchTermModes'
  | 'unlockedTargets'
  | 'blockSchedules'
> {
  return {
    savedModeSelection: null,
    strictAddons: createDefaultStrictAddonMap(),
    strictLockUntil: null,
    strictLockScope: null,
    blockedApps: [],
    blockedAppModes: {},
    blockedWebsites: [],
    blockedWebsiteModes: {},
    blockedSearchTerms: [],
    blockedSearchTermModes: {},
    unlockedTargets: {},
    blockSchedules: {},
  };
}

export function migratePersistedAppState(
  persistedState: unknown,
  persistedVersion = 0,
): Partial<PersistedAppState> {
  const persisted = persistedState && typeof persistedState === 'object'
    ? persistedState as Partial<PersistedAppState>
    : {};

  if (persistedVersion >= APP_STORE_PERSIST_VERSION) {
    return persisted;
  }

  return {
    ...persisted,
    ...buildBlockingRuntimeResetState(),
  };
}

function hasLegacyBlockingListsWithoutModes(state: Partial<ReturnType<typeof buildPersistedAppState>> | Partial<AppState> | undefined) {
  if (!state) {
    return false;
  }

  const hasBlockedTargets = Boolean(
    (Array.isArray(state.blockedApps) && state.blockedApps.length > 0)
    || (Array.isArray(state.blockedWebsites) && state.blockedWebsites.length > 0)
    || (Array.isArray(state.blockedSearchTerms) && state.blockedSearchTerms.length > 0)
    || (state.blockSchedules && Object.keys(state.blockSchedules).length > 0),
  );

  if (!hasBlockedTargets) {
    return false;
  }

  return Object.keys(state.blockedAppModes || {}).length === 0
    && Object.keys(state.blockedWebsiteModes || {}).length === 0
    && Object.keys(state.blockedSearchTermModes || {}).length === 0;
}

function buildCriticalPersistedAppState(state: Partial<ReturnType<typeof buildPersistedAppState>>) {
  const discardLegacyBlockingLists = hasLegacyBlockingListsWithoutModes(state);

  return {
    savedModeSelection: state.savedModeSelection ?? null,
    strictAddons: migrateLegacyStrictAddons({
      strictAddons: state.strictAddons as StrictAddonMap | undefined,
      strictStartTime: state.strictStartTime ?? '08:00',
      strictEndTime: state.strictEndTime ?? '17:00',
    }),
    blockingMode: state.blockingMode ?? 'reflective',
    strictStartTime: state.strictStartTime ?? '08:00',
    strictEndTime: state.strictEndTime ?? '17:00',
    breathingRounds: typeof state.breathingRounds === 'number' ? state.breathingRounds : 3,
    interventionInterval: typeof state.interventionInterval === 'number' ? state.interventionInterval : 20,
    defaultUnlockDurationMinutes:
      typeof state.defaultUnlockDurationMinutes === 'number' ? state.defaultUnlockDurationMinutes : 15,
    modeProtection: state.modeProtection ?? 'standard',
    strictLockUntil: typeof state.strictLockUntil === 'number' ? state.strictLockUntil : null,
    strictLockScope: state.strictLockScope ?? null,
    dailyStats: state.dailyStats,
    selectedPattern: state.selectedPattern ?? 'box',
    streak: typeof state.streak === 'number' ? state.streak : 0,
    lastCheckinDate: state.lastCheckinDate ?? null,
    blockedApps: discardLegacyBlockingLists ? [] : Array.isArray(state.blockedApps) ? state.blockedApps : [],
    blockedAppModes: discardLegacyBlockingLists ? {} : state.blockedAppModes ?? {},
    blockedWebsites: discardLegacyBlockingLists ? [] : Array.isArray(state.blockedWebsites) ? state.blockedWebsites : [],
    blockedWebsiteModes: discardLegacyBlockingLists ? {} : state.blockedWebsiteModes ?? {},
    blockedSearchTerms: discardLegacyBlockingLists ? [] : Array.isArray(state.blockedSearchTerms) ? state.blockedSearchTerms : [],
    blockedSearchTermModes: discardLegacyBlockingLists ? {} : state.blockedSearchTermModes ?? {},
    interventionPatternId: state.interventionPatternId ?? 'box',
    unlockedTargets: state.unlockedTargets ?? {},
    blockSchedules: discardLegacyBlockingLists ? {} : state.blockSchedules ?? {},
    appLanguage: state.appLanguage ?? DEFAULT_APP_LANGUAGE,
    installedAppLanguagePacks: state.installedAppLanguagePacks,
    notificationsEnabled: typeof state.notificationsEnabled === 'boolean' ? state.notificationsEnabled : true,
    notificationPreferences: state.notificationPreferences,
    notificationPermissionPromptSeen:
      typeof state.notificationPermissionPromptSeen === 'boolean' ? state.notificationPermissionPromptSeen : false,
    appIntroSeen: typeof state.appIntroSeen === 'boolean' ? state.appIntroSeen : false,
    penaltyAmountSats:
      typeof state.penaltyAmountSats === 'number' || state.penaltyAmountSats === null
        ? state.penaltyAmountSats
        : null,
    penaltyEnabled: typeof state.penaltyEnabled === 'boolean' ? state.penaltyEnabled : false,
    accountabilityPartner: state.accountabilityPartner ?? null,
    albyConnection: state.albyConnection ?? null,
    albyConnectionTest: state.albyConnectionTest,
  };
}

function prunePersistedAppStoreValue(serializedValue: string): string | null {
  try {
    const parsed = JSON.parse(serializedValue) as {
      state?: Partial<PersistedAppState>;
      version?: number;
    };
    if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object') {
      return null;
    }

    return JSON.stringify({
      ...parsed,
      state: buildCriticalPersistedAppState(
        migratePersistedAppState(parsed.state, parsed.version),
      ),
    });
  } catch {
    return null;
  }
}

export const appStoreStorage = createQuotaResilientJsonStorage(APP_STORE_PERSIST_KEY, prunePersistedAppStoreValue);

export async function waitForAppStorePersistence(timeoutMs = 2500) {
  await waitForPersistStorageIdle(APP_STORE_PERSIST_KEY, timeoutMs);
}

export function mergePersistedAppState(persistedState: unknown, currentState: AppState): AppState {
  const persisted = persistedState as Partial<AppState> | undefined;
  const discardLegacyBlockingLists = hasLegacyBlockingListsWithoutModes(persisted);
  const legacyModeMaps = buildLegacyModeMaps(
    discardLegacyBlockingLists ? [] : (persisted?.blockedApps as string[] | undefined) || [],
    discardLegacyBlockingLists ? [] : (persisted?.blockedWebsites as string[] | undefined) || [],
    discardLegacyBlockingLists ? [] : (persisted?.blockedSearchTerms as string[] | undefined) || [],
    discardLegacyBlockingLists ? 'normal' : (persisted?.activeMode as ActiveMode | undefined) || 'normal',
  );
  const penaltyAmountSats = isPenaltyAmountConfigured(persisted?.penaltyAmountSats as number | null | undefined)
    ? Math.round(persisted?.penaltyAmountSats as number)
    : null;
  const albyConnectionTest = normalizeAlbyConnectionTestState(persisted?.albyConnectionTest);
  const savedModeSelection =
    persisted?.savedModeSelection === 'normal'
    || persisted?.savedModeSelection === 'strict'
    || persisted?.savedModeSelection === 'learn'
    || persisted?.savedModeSelection === 'penalty'
      ? persisted.savedModeSelection
      : discardLegacyBlockingLists
        ? null
      : persisted?.activeMode === 'normal'
        || persisted?.activeMode === 'strict'
        || persisted?.activeMode === 'learn'
        || persisted?.activeMode === 'penalty'
        ? persisted.activeMode
        : null;
  const nextState = {
    ...currentState,
    ...(persisted as Partial<AppState> | undefined),
    userProfile: buildPersistedUserProfile(persisted?.userProfile as UserProfile | null | undefined),
    checkins: buildPersistedCheckins(persisted?.checkins as CheckinEntry[] | null | undefined),
    savedModeSelection,
    strictAddons: migrateLegacyStrictAddons({
      strictAddons: persisted?.strictAddons as StrictAddonMap | undefined,
      strictCompanionModes: persisted?.strictCompanionModes as Record<string, unknown> | null | undefined,
      strictStartTime: persisted?.strictStartTime,
      strictEndTime: persisted?.strictEndTime,
    }),
    penaltyAmountSats,
    albyConnectionTest,
    penaltyTransactions: normalizePenaltyTransactions(persisted?.penaltyTransactions),
    blockedApps: discardLegacyBlockingLists ? [] : Array.isArray(persisted?.blockedApps) ? persisted.blockedApps : [],
    blockedAppModes: Object.keys(persisted?.blockedAppModes || {}).length > 0
      ? persisted?.blockedAppModes
      : legacyModeMaps.blockedAppModes,
    blockedWebsites: discardLegacyBlockingLists ? [] : Array.isArray(persisted?.blockedWebsites) ? persisted.blockedWebsites : [],
    blockedWebsiteModes: Object.keys(persisted?.blockedWebsiteModes || {}).length > 0
      ? persisted?.blockedWebsiteModes
      : legacyModeMaps.blockedWebsiteModes,
    blockedSearchTerms: discardLegacyBlockingLists ? [] : Array.isArray(persisted?.blockedSearchTerms) ? persisted.blockedSearchTerms : [],
    blockedSearchTermModes: Object.keys(persisted?.blockedSearchTermModes || {}).length > 0
      ? persisted?.blockedSearchTermModes
      : legacyModeMaps.blockedSearchTermModes,
    blockSchedules: discardLegacyBlockingLists ? {} : persisted?.blockSchedules ?? {},
    unlockedTargets: resolveUnlockedTargets(
      persisted?.unlockedTargets as Record<string, number> | undefined,
      (persisted as Partial<AppState> & { unlockedApps?: Record<string, number> } | undefined)?.unlockedApps,
    ),
  } as AppState;
  const installedAppLanguagePacks = normalizeInstalledLanguagePacks(
    persisted?.installedAppLanguagePacks as string[] | undefined,
    persisted?.appLanguage as string | undefined,
  ) as AppLanguage[];
  const accountabilityPartner = normalizeAccountabilityPartner(
    persisted?.accountabilityPartner as AccountabilityPartner | null | undefined,
  );
  const penaltyEnabled =
    Boolean(persisted?.penaltyEnabled) && isPenaltySetupReady({
      ...nextState,
      accountabilityPartner,
    });
  const derivedModeState = buildDerivedModeState({
    ...nextState,
    accountabilityPartner,
    penaltyEnabled,
  });

  return {
    ...nextState,
    ...derivedModeState,
    accountabilityPartner,
    installedAppLanguagePacks,
    penaltyEnabled,
    notificationPreferences: {
      ...defaultNotificationPreferences,
      ...(persisted?.notificationPreferences as Partial<NotificationPreferences> | undefined),
    },
    appLanguage: installedAppLanguagePacks.includes(nextState.appLanguage)
      ? nextState.appLanguage
      : DEFAULT_APP_LANGUAGE,
  };
}

export function getAssignedTargetModeFromState(
  state: Pick<AppState, 'blockedAppModes' | 'blockedWebsiteModes' | 'blockedSearchTermModes'>,
  targetType: 'app' | 'website' | 'search',
  targetId: string,
) {
  return getAssignedTargetMode(getModeCollections(state), targetType, targetId);
}

export { normalizeTargetValue, setTargetModeRecord, type NativeRuntimeIssueKey };
