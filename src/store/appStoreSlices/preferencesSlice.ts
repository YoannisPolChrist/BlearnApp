import {
  DEFAULT_APP_LANGUAGE,
  normalizeInstalledLanguagePacks,
} from '@/lib/languages';
import type { AppState } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  defaultNotificationPreferences,
} from '@/store/appStore.shared';

export const createPreferencesSlice: AppStoreSlice<Partial<AppState>> = (set) => ({
  appLanguage: DEFAULT_APP_LANGUAGE,
  installedAppLanguagePacks: normalizeInstalledLanguagePacks(undefined, DEFAULT_APP_LANGUAGE),
  notificationsEnabled: true,
  notificationPreferences: defaultNotificationPreferences,
  notificationPermissionPromptSeen: false,
  appIntroSeen: false,
  hasHydrated: false,
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
});
