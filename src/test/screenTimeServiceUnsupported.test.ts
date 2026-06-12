import { afterEach, describe, expect, it, vi } from 'vitest';

describe('screenTimeService platform guard', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('throws UnsupportedPlatformError when native runtime is missing', async () => {
    vi.doMock('@/lib/platform', () => ({
      getPlatform: () => 'web',
      platform: 'web',
      isAndroidPlatform: false,
      isNativePlatform: false,
    }));
    vi.doMock('@/plugins/ScreenTimePlugin', () => ({
      __esModule: true,
      default: {},
    }));

    const service = await import('@/services/screenTimeService');

    await expect(service.checkPermissions()).rejects.toBeInstanceOf(service.UnsupportedPlatformError);
    await expect(service.getTodayUsage()).rejects.toBeInstanceOf(service.UnsupportedPlatformError);
    await expect(service.openGate('app', 'app')).rejects.toBeInstanceOf(service.UnsupportedPlatformError);
  });
});
