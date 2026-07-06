import {
  DEFAULT_APP_LANGUAGE,
  normalizeInstalledLanguagePacks,
} from '@/lib/languages';
import type { AppState, RemoteBlockingInstruction } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  defaultNotificationPreferences,
} from '@/store/appStore.shared';

const matchesCategory = (
  appName: string,
  pkgName: string,
  androidCategory: number | undefined,
  category: string,
): boolean => {
  const name = (appName + ' ' + pkgName).toLowerCase();
  if (category === 'social_media') {
    return /instagram|tiktok|facebook|twitter|snapchat|pinterest|linkedin|reddit/.test(name);
  }
  if (category === 'games') {
    return androidCategory === 0
      || /game|candy|clash|pokemon|angrybirds|pubg|fortnite|minecraft|nintendo/.test(name);
  }
  if (category === 'entertainment' || category === 'streaming') {
    return /netflix|youtube|twitch|prime|disney|hbo|spotify|deezer/.test(name);
  }
  if (category === 'browser') {
    return /chrome|firefox|opera|browser|safari|edge|duckduckgo/.test(name);
  }
  if (category === 'search') {
    return /google|search|bing|yahoo/.test(name);
  }
  return false;
};

export const createPreferencesSlice: AppStoreSlice<Partial<AppState>> = (set, get) => ({
  appLanguage: DEFAULT_APP_LANGUAGE,
  installedAppLanguagePacks: normalizeInstalledLanguagePacks(undefined, DEFAULT_APP_LANGUAGE),
  notificationsEnabled: true,
  notificationPreferences: defaultNotificationPreferences,
  notificationPermissionPromptSeen: false,
  appIntroSeen: false,
  hasHydrated: false,
  remoteBlockingEnabled: true,
  remoteBlockingInstruction: null,
  resolvedRemoteBlockedApps: [],

  setAppLanguage: (language) =>
    set((state) => ({
      appLanguage: state.installedAppLanguagePacks.includes(language) ? language : DEFAULT_APP_LANGUAGE,
    })),
  installAppLanguagePack: (language) =>
    set((state) => ({
      installedAppLanguagePacks: normalizeInstalledLanguagePacks([
        ...state.installedAppLanguagePacks,
        language,
      ]),
    })),
  removeAppLanguagePack: (language) =>
    set((state) => {
      const nextInstalled = normalizeInstalledLanguagePacks(
        state.installedAppLanguagePacks.filter((entry) => entry !== language),
      );
      const nextLanguage = nextInstalled.includes(state.appLanguage) ? state.appLanguage : DEFAULT_APP_LANGUAGE;

      return {
        installedAppLanguagePacks: nextInstalled,
        appLanguage: nextLanguage,
      };
    }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setNotificationPreference: (key, enabled) =>
    set((state) => ({
      notificationPreferences: {
        ...state.notificationPreferences,
        [key]: enabled,
      },
    })),
  setNotificationPermissionPromptSeen: (seen) => set({ notificationPermissionPromptSeen: seen }),
  setAppIntroSeen: (seen) => set({ appIntroSeen: seen }),

  setRemoteBlockingEnabled: (enabled) =>
    set((state) => {
      const nextEnabled = enabled;
      const instruction = nextEnabled ? state.remoteBlockingInstruction : null;
      return {
        remoteBlockingEnabled: nextEnabled,
        remoteBlockingInstruction: instruction,
        resolvedRemoteBlockedApps: instruction ? state.resolvedRemoteBlockedApps : [],
      };
    }),

  setRemoteBlockingInstruction: async (instruction: RemoteBlockingInstruction | null) => {
    const enabled = get().remoteBlockingEnabled ?? true;

    if (!enabled || !instruction || instruction.expiresAt <= Date.now()) {
      set({
        remoteBlockingInstruction: instruction,
        resolvedRemoteBlockedApps: [],
      });
      return;
    }

    // Package-Namen konsequent lowercase halten: nativePolicy sanitisiert IDs auf
    // lowercase und schlaegt danach die Modes per Key nach — ein Case-Mismatch wuerde
    // den Target sonst still aus der Policy filtern.
    const apps = new Set<string>(
      (instruction.blockedApps || []).map((appId) => appId.trim().toLowerCase()),
    );

    if (instruction.blockedCategories?.length) {
      try {
        const { getInstalledApps } = await import('@/services/screenTimeInstalledApps');
        const installed = await getInstalledApps();
        installed.forEach((app) => {
          const appLabel = (app.label || app.appName || '').toLowerCase();
          const pkg = (app.packageName || app.appId || '').toLowerCase();
          instruction.blockedCategories?.forEach((cat) => {
            if (matchesCategory(appLabel, pkg, app.category, cat)) {
              apps.add((app.packageName || app.appId).trim().toLowerCase());
            }
          });
        });
      } catch (err) {
        console.warn('[RemoteBlocking] Failed to resolve categories:', err);
      }
    }

    set({
      remoteBlockingInstruction: instruction,
      resolvedRemoteBlockedApps: Array.from(apps),
    });
  },
});
