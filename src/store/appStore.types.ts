import type { AlbyConnectionConfig } from '@/services/albyWalletService';
import {
  type SupportedAppLanguage,
} from '@/lib/languages';
import type {
  ActiveModeId,
  TargetModeId,
  StrictAddonMap,
  StrictAddonModeId,
  StrictAddonState,
} from '@/lib/targetModes';
import { isPenaltyPartnerVerified } from '@/lib/penaltyRuntime';

export interface BreathPhase {
  type: 'inhale' | 'hold' | 'exhale' | 'rest';
  duration: number;
  instruction: string;
}

export interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  phases: BreathPhase[];
  totalCycles: number;
}

export interface Emotion {
  id: string;
  emoji: string;
  label: string;
}

export interface EmotionCategory {
  id: string;
  label: string;
  color: string;
  emotions: Emotion[];
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  instruction: string;
  icon: string;
  duration: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CheckinEntry {
  id: string;
  timestamp: number;
  emotions: string[];
  reflection: string;
  chatHistory: { role: 'user' | 'ai'; text: string }[];
  breathingCompleted: boolean;
  targetApp?: string;
}

export interface UserProfile {
  commonEmotions: Record<string, number>;
  triggerTimes: number[];
  recentInteractions: UserInteraction[];
  totalSessions: number;
  totalChallengesCompleted: number;
  consecutiveDays: number;
  completedChallenges: string[];
}

export interface UserInteraction {
  id?: string;
  timestamp: number;
  type: 'checkin' | 'breathing' | 'challenge' | 'pause' | 'learning';
  emotions?: string[];
  intention?: string;
  completed: boolean;
  targetApp?: string;
  challenge?: string;
  durationMinutes?: number;
}

export interface DailyStats {
  breathingSessions: number;
  totalBreathingMinutes: number;
  checkinsCompleted: number;
  challengesCompleted: number;
  pausesTaken: number;
}

export type ActiveMode = 'normal' | ActiveModeId;
export type SavedModeSelection = 'normal' | TargetModeId;
export type BlockingMode = 'reflective' | 'hard';
export type LockScope = 'full' | 'settings';
export type NativeRuntimeIssueKey = 'blockingService' | 'websiteBlocking' | 'searchTermSync' | 'policySync';
export type NativeRuntimeIssues = Record<NativeRuntimeIssueKey, string | null>;

export interface PenaltyTransaction {
  id: string;
  timestamp: number;
  amountSats?: number;
  amount?: number;
  type: 'deposit' | 'penalty' | 'withdrawal';
  description: string;
  targetApp?: string;
  notificationSent?: boolean;
  blockType?: 'app' | 'website' | 'search';
  deliveryStatus?: 'processing' | 'sent' | 'failed';
  deliveryAttempts?: number;
  lastDeliveryError?: string;
  remoteReference?: string;
  feesPaidSats?: number;
  sentAt?: number;
  deliveredAt?: number;
}

export type AlbyConnectionTestStatus = 'idle' | 'testing' | 'passed' | 'failed';

export interface AlbyConnectionTestState {
  status: AlbyConnectionTestStatus;
  testedAt?: number;
  walletAlias?: string;
  walletLightningAddress?: string;
  balanceSats?: number;
  budgetTotalSats?: number | null;
  budgetUsedSats?: number | null;
  budgetRemainingSats?: number | null;
  budgetRenewsAt?: number | null;
  budgetRenewal?: string | null;
  lastError?: string;
}

export interface PenaltyChargeResult {
  transactionId: string;
  paymentReference: string;
  sentAt: number;
  amountSats: number;
  feesPaidSats: number;
}

export interface AccountabilityPartner {
  name: string;
  email?: string;
  lightningAddress: string;
  normalizedLightningAddress?: string;
  validationStatus: 'unverified' | 'verified' | 'invalid';
  validationMessage?: string;
  validatedAt?: number;
  notifyOnPenalty: boolean;
}

export function isVerifiedAccountabilityPartner(partner: AccountabilityPartner | null | undefined): boolean {
  return isPenaltyPartnerVerified(partner);
}

export type AppLanguage = SupportedAppLanguage;

export interface NotificationPreferences {
  reminders: boolean;
  statusHints: boolean;
  learnProgress: boolean;
  penaltyAlerts: boolean;
}

export interface LastModeActivationSnapshot {
  modes: ActiveModeId[];
  activatedAt: number;
}

export interface AppState {
  activeMode: ActiveMode;
  activeModes: ActiveModeId[];
  savedModeSelection: SavedModeSelection | null;
  strictAddons: StrictAddonMap;
  blockingMode: BlockingMode;
  strictStartTime: string;
  strictEndTime: string;
  breathingRounds: number;
  interventionInterval: number;
  defaultUnlockDurationMinutes: number;
  modeProtection: 'standard' | 'selfLock';
  lastModeActivation: LastModeActivationSnapshot | null;
  setSavedModeSelection: (mode: SavedModeSelection) => void;
  setStrictAddonState: (mode: StrictAddonModeId, next: StrictAddonState) => void;
  setStrictAddonConfig: (mode: StrictAddonModeId, partial: Partial<StrictAddonState>) => void;
  setBlockingMode: (mode: BlockingMode) => void;
  setStrictSchedule: (start: string, end: string) => void;
  setBreathingRounds: (rounds: number) => void;
  setInterventionInterval: (minutes: number) => void;
  setDefaultUnlockDurationMinutes: (minutes: number) => void;
  setModeProtection: (modeProtection: 'standard' | 'selfLock') => void;

  strictLockUntil: number | null;
  strictLockScope: LockScope | null;
  activateStrictLock: (options?: { preserveActiveMode?: boolean; scope?: LockScope }) => void;
  activateStrictAddon: (mode: StrictAddonModeId, lockedAppIds: string[]) => void;
  clearExpiredStrictLock: () => void;
  forceReleaseLock: () => void;
  clearExpiredStrictAddons: () => void;
  forceReleaseAddonLocks: () => void;
  isStrictLocked: () => boolean;
  isStrictAddonLocked: (mode: StrictAddonModeId) => boolean;
  getStrictLockRemaining: () => number;

  dailyStats: DailyStats;
  incrementBreathingSessions: (minutes: number) => void;
  incrementCheckins: () => void;
  incrementChallenges: () => void;
  incrementPauses: () => void;

  userProfile: UserProfile;
  addInteraction: (interaction: UserInteraction) => void;
  resetProfile: () => void;

  checkins: CheckinEntry[];
  addCheckin: (entry: CheckinEntry) => void;

  selectedPattern: string;
  setSelectedPattern: (id: string) => void;

  streak: number;
  lastCheckinDate: string | null;
  updateStreak: () => void;

  blockedApps: string[];
  blockedAppModes: Record<string, TargetModeId>;
  toggleBlockedApp: (app: string, mode: TargetModeId) => void;
  setBlockedAppsMode: (apps: string[], mode: TargetModeId) => void;
  replaceBlockingState: (payload: {
    blockedApps: string[];
    blockedAppModes: Record<string, TargetModeId>;
    blockedWebsites: string[];
    blockedWebsiteModes: Record<string, TargetModeId>;
    blockedSearchTerms: string[];
    blockedSearchTermModes: Record<string, TargetModeId>;
    blockSchedules: Record<string, { from: string; to: string }>;
  }) => void;

  blockedWebsites: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  toggleBlockedWebsite: (url: string, mode: TargetModeId) => void;
  addBlockedWebsite: (url: string, mode: TargetModeId) => void;
  removeBlockedWebsite: (url: string) => void;
  toggleBlockedSearchTerm: (term: string, mode: TargetModeId) => void;
  addBlockedSearchTerm: (term: string, mode: TargetModeId) => void;
  removeBlockedSearchTerm: (term: string) => void;
  getTargetMode: (targetId: string, targetType: 'app' | 'website' | 'search') => TargetModeId | null;

  interventionPatternId: string;
  setInterventionPatternId: (id: string) => void;

  unlockedTargets: Record<string, number>;
  /** Timestamps erfolgreicher Freischaltungen (für "Entsperrungen heute"). */
  unlockHistory: number[];
  unlockTarget: (targetId: string, targetType: 'app' | 'website' | 'search', durationMinutes?: number) => void;
  /** Anzahl der heutigen Freischaltungen (lokale Mitternacht als Grenze). */
  getUnlocksToday: () => number;
  isTargetUnlocked: (targetId: string, targetType: 'app' | 'website' | 'search') => boolean;

  blockSchedules: Record<string, { from: string; to: string }>;
  setBlockSchedule: (app: string, from: string, to: string) => void;
  removeBlockSchedule: (app: string) => void;

  nativeRuntimeIssues: NativeRuntimeIssues;
  setNativeRuntimeIssue: (key: NativeRuntimeIssueKey, message: string) => void;
  clearNativeRuntimeIssue: (key: NativeRuntimeIssueKey) => void;

  appLanguage: AppLanguage;
  installedAppLanguagePacks: AppLanguage[];
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  notificationPermissionPromptSeen: boolean;
  appIntroSeen: boolean;
  hasHydrated: boolean;
  setAppLanguage: (language: AppLanguage) => void;
  installAppLanguagePack: (language: AppLanguage) => void;
  removeAppLanguagePack: (language: AppLanguage) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, enabled: boolean) => void;
  setNotificationPermissionPromptSeen: (seen: boolean) => void;
  setAppIntroSeen: (seen: boolean) => void;

  penaltyAmountSats: number | null;
  penaltyEnabled: boolean;
  penaltyTransactions: PenaltyTransaction[];
  accountabilityPartner: AccountabilityPartner | null;
  albyConnection: AlbyConnectionConfig | null;
  albyConnectionTest: AlbyConnectionTestState;
  setPenaltyAmountSats: (amountSats: number | null) => void;
  setPenaltyEnabled: (enabled: boolean) => void;
  testAlbyConnection: () => Promise<AlbyConnectionTestState>;
  deductPenalty: (targetApp: string, blockType: 'app' | 'website' | 'search') => Promise<PenaltyChargeResult>;
  getTotalPenalties: () => number;
  getWeeklyPenalties: () => number;
  setAccountabilityPartner: (partner: AccountabilityPartner | null) => void;
  setAlbyConnection: (connection: AlbyConnectionConfig | null) => void;
}
