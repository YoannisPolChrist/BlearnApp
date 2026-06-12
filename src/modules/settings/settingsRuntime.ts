import { isUnsupportedPlatformError } from '@/services/screenTimeService';

export const PERMISSIONS_GUIDE_STORAGE_KEY = 'blearn-permissions-guide-seen';
export const SETTINGS_PERMISSIONS_PANEL_VALUE = 'system-permissions';

export function getSettingsRuntimeErrorMessage(error: unknown) {
  if (isUnsupportedPlatformError(error)) {
    return 'Diese Android-Einstellungen sind nur in der nativen App verfügbar. Starte Blearn auf Android, um Rechte und Schutzstatus zu prüfen.';
  }

  return 'Die Android-Berechtigungen konnten nicht geladen werden. Prüfe dein Setup und versuche es erneut.';
}

export function isInsideStrictScheduleWindow(strictStartTime: string, strictEndTime: string) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = strictStartTime.split(':').map(Number);
  const [endH, endM] = strictEndTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}
