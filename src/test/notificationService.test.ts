import { afterEach, describe, expect, it, vi } from 'vitest';

const screenTimeMock = {
  getNotificationPermissionState: vi.fn(),
  requestNotificationPermission: vi.fn(),
  syncNotificationPreferences: vi.fn(),
  dispatchNotification: vi.fn(),
};
const originalNotification = window.Notification;

function setWebNotification(permission: 'default' | 'granted' | 'denied') {
  const requestPermission = vi.fn().mockResolvedValue(permission);
  const NotificationMock = vi.fn().mockImplementation((title: string, options?: NotificationOptions) => ({
    title,
    options,
  }));
  Object.defineProperty(NotificationMock, 'permission', {
    configurable: true,
    value: permission,
  });
  Object.defineProperty(NotificationMock, 'requestPermission', {
    configurable: true,
    value: requestPermission,
  });
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: NotificationMock,
  });
  return { requestPermission, NotificationMock };
}

async function loadService(isAndroidPlatform: boolean) {
  vi.resetModules();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform,
  }));
  vi.doMock('@/plugins/ScreenTimePlugin', () => ({
    default: screenTimeMock,
  }));

  return import('@/services/notificationService');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/plugins/ScreenTimePlugin');
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: originalNotification,
  });
});

describe('notificationService', () => {
  it('falls back to the browser Notification API outside Android', async () => {
    const { requestPermission, NotificationMock } = setWebNotification('granted');
    const service = await loadService(false);

    await expect(service.getNotificationPermissionState()).resolves.toBe('granted');
    await expect(service.requestNotificationPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);

    await expect(
      service.syncNotificationPreferences({
        enabled: true,
        preferences: {
          reminders: true,
          statusHints: true,
          learnProgress: true,
          penaltyAlerts: true,
        },
        preview: {
          category: 'statusHints',
          title: 'Preview',
          body: 'Hello browser',
        },
      }),
    ).resolves.toBeUndefined();

    expect(NotificationMock).toHaveBeenCalledWith('Preview', {
      body: 'Hello browser',
    });
  });

  it('uses the Android native bridge for permission and preview dispatch', async () => {
    screenTimeMock.getNotificationPermissionState.mockResolvedValue({
      state: 'granted',
      enabled: true,
    });
    screenTimeMock.requestNotificationPermission.mockResolvedValue({
      state: 'granted',
      enabled: true,
    });
    screenTimeMock.syncNotificationPreferences.mockResolvedValue({
      enabled: true,
      previewSent: true,
      state: 'granted',
    });
    screenTimeMock.dispatchNotification.mockResolvedValue({
      sent: true,
    });

    const service = await loadService(true);

    await expect(service.getNotificationPermissionState()).resolves.toBe('granted');
    await expect(service.requestNotificationPermission()).resolves.toBe('granted');

    await expect(
      service.syncNotificationPreferences({
        enabled: true,
        preferences: {
          reminders: true,
          statusHints: false,
          learnProgress: true,
          penaltyAlerts: false,
        },
        preview: {
          category: 'learnProgress',
          title: 'Learn',
          body: 'Preview notification',
        },
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.dispatchNotification({
        category: 'penaltyAlerts',
        title: 'Penalty',
        body: 'Dispatch notification',
      }),
    ).resolves.toBe(true);

    expect(screenTimeMock.getNotificationPermissionState).toHaveBeenCalledTimes(1);
    expect(screenTimeMock.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(screenTimeMock.syncNotificationPreferences).toHaveBeenCalledWith({
      enabled: true,
      preferences: {
        reminders: true,
        statusHints: false,
        learnProgress: true,
        penaltyAlerts: false,
      },
      preview: {
        category: 'learnProgress',
        title: 'Learn',
        body: 'Preview notification',
      },
    });
    expect(screenTimeMock.dispatchNotification).toHaveBeenCalledWith({
      category: 'penaltyAlerts',
      title: 'Penalty',
      body: 'Dispatch notification',
    });
  });
});
