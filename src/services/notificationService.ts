import { isAndroidPlatform } from '@/lib/platform';
import ScreenTime, {
  type NotificationChannelKey,
  type NotificationDispatchOptions,
  type NotificationPermissionStatus,
  type NotificationSyncOptions,
} from '@/plugins/ScreenTimePlugin';
import type { NotificationPreferences } from '@/store/appStore.types';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export type NotificationPreviewOptions = NotificationDispatchOptions;

export interface NotificationPreferencesSyncOptions {
  enabled: boolean;
  preferences: NotificationPreferences;
  preview?: NotificationPreviewOptions | null;
}

function isWebNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof window.Notification?.requestPermission === 'function'
  );
}

function normalizePermissionState(state: NotificationPermissionStatus['state'] | string | undefined): NotificationPermissionState {
  if (state === 'granted' || state === 'denied' || state === 'default' || state === 'unsupported') {
    return state;
  }

  return 'unsupported';
}

function readWebPermissionState(): NotificationPermissionState {
  if (!isWebNotificationSupported()) {
    return 'unsupported';
  }

  const permission = window.Notification.permission;
  if (permission === 'granted' || permission === 'denied') {
    return permission;
  }

  return 'default';
}

async function dispatchWebNotification(options: NotificationDispatchOptions): Promise<boolean> {
  if (!isWebNotificationSupported()) {
    return false;
  }

  if (window.Notification.permission !== 'granted') {
    return false;
  }

  new window.Notification(options.title, {
    body: options.body,
  });
  return true;
}

async function getNativePermissionState(): Promise<NotificationPermissionState> {
  try {
    const result = await ScreenTime.getNotificationPermissionState();
    return normalizePermissionState(result.state);
  } catch {
    return 'unsupported';
  }
}

async function requestNativePermission(): Promise<NotificationPermissionState> {
  try {
    const result = await ScreenTime.requestNotificationPermission();
    return normalizePermissionState(result.state);
  } catch {
    return 'unsupported';
  }
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (isAndroidPlatform) {
    return getNativePermissionState();
  }

  return readWebPermissionState();
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isAndroidPlatform) {
    return requestNativePermission();
  }

  if (!isWebNotificationSupported()) {
    return 'unsupported';
  }

  const permission = await window.Notification.requestPermission();
  if (permission === 'granted' || permission === 'denied') {
    return permission;
  }

  return 'default';
}

export async function syncNotificationPreferences(options: NotificationPreferencesSyncOptions): Promise<void> {
  if (isAndroidPlatform) {
    const nativeOptions: NotificationSyncOptions = {
      enabled: options.enabled,
      preferences: options.preferences,
      preview: options.preview ?? null,
    };
    await ScreenTime.syncNotificationPreferences(nativeOptions);
    return;
  }

  if (options.enabled && options.preview) {
    await dispatchWebNotification(options.preview);
  }
}

export async function dispatchNotification(options: NotificationDispatchOptions): Promise<boolean> {
  if (isAndroidPlatform) {
    const result = await ScreenTime.dispatchNotification(options);
    return Boolean(result.sent);
  }

  return dispatchWebNotification(options);
}

export type { NotificationChannelKey, NotificationDispatchOptions };
