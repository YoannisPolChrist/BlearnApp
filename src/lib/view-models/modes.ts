import type { InstalledApp, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import { isBlockableAppTargetId } from '@/lib/blockableApps';
import { getDeckLearningStats, type GateRule, type LearningDeck, type LearningPreset, type ReviewLog } from '@/lib/learning';
import { formatReviewMixLabel } from '@/lib/view-models/learn';
import { getAppId, getAppLabel } from '@/services/screenTimeNormalization';
import type { AccountabilityPartner } from '@/store/useAppStore';
import type { TargetModeId } from '@/lib/targetModes';

export const INITIAL_VISIBLE_APPS = 40;

export interface VisibleAppItem {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastUsedTimestamp: number;
  icon?: string;
}

function compareVisibleApps(left: VisibleAppItem, right: VisibleAppItem) {
  if (right.totalTimeMs !== left.totalTimeMs) return right.totalTimeMs - left.totalTimeMs;
  return left.appName.localeCompare(right.appName, 'de', { sensitivity: 'base' });
}

const SYSTEM_PACKAGE_PREFIXES = [
  'com.android.systemui',
  'com.android.launcher',
  'com.android.launcher3',
  'com.android.permissioncontroller',
  'com.google.android.permissioncontroller',
  'com.android.settings',
  'com.android.providers.',
  'com.android.inputmethod.',
  'com.google.android.inputmethod.',
  'com.miui.home',
  'com.mi.android.globallauncher',
];

const SYSTEM_LABEL_KEYWORDS = [
  'launcher',
  'system ui',
  'system-ui',
  'systemui',
  'permission controller',
  'benachrichtigungs',
  'systembenutzeroberfl',
  'notification',
];

function isSystemAppCandidate(entry: Partial<InstalledApp> & { packageName?: string; appName?: string }) {
  const packageName = getAppId(entry).toLowerCase();
  const label = getAppLabel(entry).toLowerCase();
  if (!packageName && !label) return false;
  if (!isBlockableAppTargetId(packageName)) return true;

  for (const prefix of SYSTEM_PACKAGE_PREFIXES) {
    if (prefix.endsWith('.')) {
      if (packageName.startsWith(prefix)) return true;
    } else if (packageName === prefix || packageName.startsWith(`${prefix}.`)) {
      return true;
    }
  }

  const isSystemNamespace = /^(com\.android\.|com\.google\.android\.|com\.miui\.|com\.mi\.|android\.)/.test(packageName);
  if ((isSystemNamespace || !packageName) && SYSTEM_LABEL_KEYWORDS.some((keyword) => label.includes(keyword))) {
    return true;
  }

  return false;
}

export const APP_ICONS: Record<string, string> = {
  'com.instagram.android': 'IG',
  'com.whatsapp': 'WA',
  'com.tiktok.android': 'TT',
  'com.twitter.android': 'X',
  'com.snapchat.android': 'SC',
  'com.google.android.youtube': 'YT',
  'com.spotify.music': 'SP',
  'com.reddit.frontpage': 'RD',
  'com.facebook.katana': 'FB',
  'com.netflix.mediaclient': 'NF',
  'com.discord': 'DC',
};

export function getAppBadge(entry: Partial<InstalledApp> & { packageName?: string; appName?: string }) {
  const entryId = getAppId(entry).toLowerCase();
  const knownBadge = APP_ICONS[entryId];
  if (knownBadge) return knownBadge;

  return (
    getAppLabel(entry)
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'AP'
  );
}

export function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function getScheduleDurationHours(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Effektives Lock-Ende als "HH:MM": Der Store clampt Strict-Fenster hart auf
 * maxHours — die UI zeigt die geclampte Endzeit an, damit das nie überrascht.
 */
export function getEffectiveStrictLockEndTime(start: string, end: string, maxHours: number): string {
  if (getScheduleDurationHours(start, end) <= maxHours) {
    return end;
  }

  const [startHour, startMinute] = start.split(':').map(Number);
  const effectiveMinutes = (startHour * 60 + startMinute + Math.round(maxHours * 60)) % (24 * 60);
  const hours = Math.floor(effectiveMinutes / 60);
  const minutes = effectiveMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function buildVisibleApps(options: {
  installedApps: InstalledApp[];
  usage: ScreenTimeSummary | null;
  blockedApps: string[];
  query: string;
  showAllApps: boolean;
}) {
  const merged = new Map<string, VisibleAppItem>();

  for (const app of options.installedApps) {
    const appId = getAppId(app);
    merged.set(appId, {
      packageName: appId,
      appName: getAppLabel(app),
      totalTimeMs: 0,
      lastUsedTimestamp: 0,
      icon: app.icon,
    });
  }

  for (const entry of options.usage?.entries ?? []) {
    const appId = getAppId(entry);
    if (!appId) continue;
    const current = merged.get(appId);
    if (!current && !isBlockableAppTargetId(appId)) {
      continue;
    }
    merged.set(appId, {
      packageName: appId,
      appName: getAppLabel(entry),
      totalTimeMs: entry.totalTimeMs,
      lastUsedTimestamp: entry.lastUsedTimestamp,
      icon: current?.icon,
    });
  }

  const allVisibleApps = Array.from(merged.values())
    .filter((app) => !isSystemAppCandidate(app))
    .sort((left, right) => {
    const blockedDelta =
      Number(options.blockedApps.includes(right.packageName)) - Number(options.blockedApps.includes(left.packageName));
    if (blockedDelta !== 0) return blockedDelta;
    return compareVisibleApps(left, right);
  });

  const normalizedQuery = options.query.trim().toLowerCase();
  const filteredVisibleApps =
    normalizedQuery.length === 0
      ? allVisibleApps
      : allVisibleApps.filter((entry) => {
          const appName = entry.appName.toLowerCase();
          const packageName = entry.packageName.toLowerCase();
          return appName.includes(normalizedQuery) || packageName.includes(normalizedQuery);
        });

  const shouldShowFullAppList = normalizedQuery.length > 0 || options.showAllApps;
  const displayedApps = shouldShowFullAppList
    ? filteredVisibleApps
    : filteredVisibleApps.slice(0, INITIAL_VISIBLE_APPS);

  return {
    allVisibleApps,
    filteredVisibleApps,
    displayedApps,
    shouldShowFullAppList,
  };
}

export function buildModeAppLists(options: {
  filteredVisibleApps: VisibleAppItem[];
  blockedAppModes: Record<string, TargetModeId>;
  editableMode: TargetModeId | null;
  shouldShowFullAppList: boolean;
}) {
  if (!options.editableMode) {
    return {
      availableApps: [] as VisibleAppItem[],
      displayedAvailableApps: [] as VisibleAppItem[],
      assignedToSelectedMode: [] as VisibleAppItem[],
      assignedToOtherModes: [] as Array<VisibleAppItem & { mode: TargetModeId }>,
      remainingAvailableCount: 0,
    };
  }

  const assignedToSelectedMode = options.filteredVisibleApps.filter(
    (app) => options.blockedAppModes[app.packageName] === options.editableMode,
  ).sort(compareVisibleApps);

  const assignedToOtherModes = options.filteredVisibleApps
    .map((app) => {
      const mode = options.blockedAppModes[app.packageName];
      if (!mode || mode === options.editableMode) return null;
      return { ...app, mode };
    })
    .filter((app): app is VisibleAppItem & { mode: TargetModeId } => Boolean(app))
    .sort(compareVisibleApps);

  const availableApps = options.filteredVisibleApps.filter(
    (app) => !options.blockedAppModes[app.packageName],
  ).sort(compareVisibleApps);

  const displayedAvailableApps = options.shouldShowFullAppList
    ? availableApps
    : availableApps.slice(0, INITIAL_VISIBLE_APPS);

  return {
    availableApps,
    displayedAvailableApps,
    assignedToSelectedMode,
    assignedToOtherModes,
    remainingAvailableCount: Math.max(0, availableApps.length - displayedAvailableApps.length),
  };
}

export function buildDeckStats(options: {
  decks: LearningDeck[];
  cards: Array<{
    deckId: string;
    id: string;
    noteId: string;
    type: 'basic' | 'cloze';
    state: 'new' | 'learning' | 'review' | 'relearning';
    dueAt: number;
    intervalDays: number;
    easeFactor: number;
    reps: number;
    lapses: number;
    stepIndex: number;
    memoryState: { stability: number; difficulty: number } | null;
    createdAt: number;
    lastReviewedAt?: number;
    scheduledDays?: number;
    elapsedDays?: number;
  }>;
  reviewLogs: ReviewLog[];
  presets: LearningPreset[];
  gateRule: GateRule;
  activeDeckId?: string;
  getDueCardsForDecks: (deckIds?: string[]) => Array<unknown>;
  getResolvedPresetForDeck: (deckId: string) => LearningPreset;
}) {
  const deckStats = options.decks.map((deck) => {
    const preset = options.getResolvedPresetForDeck(deck.id);

    return {
      ...deck,
      ...getDeckLearningStats({
        deck,
        cards: options.cards,
        reviewLogs: options.reviewLogs,
        preset,
        gateRule: options.gateRule,
      }),
      reviewsBetweenNewCards: preset.reviewsBetweenNewCards,
      reviewMixLabel: formatReviewMixLabel(preset.reviewsBetweenNewCards),
    };
  });

  const latestDeck = [...deckStats].sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const resolvedLearnDeck = deckStats.find((deck) => deck.id === options.activeDeckId) ?? latestDeck;

  return {
    deckStats,
    latestDeck,
    resolvedLearnDeck,
  };
}

export function getPenaltySetupStatus(options: {
  albyReady: boolean;
  connectionTestPassed: boolean;
  penaltyAmountSats: number | null;
  accountabilityPartner: AccountabilityPartner | null;
  recipientVerified: boolean;
}) {
  const recipientName = options.accountabilityPartner?.name || 'Noch kein Empfänger gespeichert';
  const recipientAddress = options.accountabilityPartner?.lightningAddress || 'Lightning-Adresse fehlt noch';
  const recipientStatusMessage = options.recipientVerified
    ? 'Adresse verifiziert'
    : options.accountabilityPartner?.validationMessage || 'Empfänger noch nicht verifiziert';

  return {
    penaltySetupReady: Boolean(
      options.albyReady
      && options.connectionTestPassed
      && options.recipientVerified
      && typeof options.penaltyAmountSats === 'number'
      && options.penaltyAmountSats > 0,
    ),
    connectionStatusMessage: options.connectionTestPassed
      ? 'Verbindung live getestet'
      : options.albyReady
        ? 'Live-Test noch ausstehend'
        : 'Wallet noch nicht verbunden',
    penaltyAmountConfigured: typeof options.penaltyAmountSats === 'number' && options.penaltyAmountSats > 0,
    recipientName,
    recipientAddress,
    recipientStatusMessage,
  };
}
