import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

afterEach(() => {
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/components/setup/AppTourProvider');
  vi.doUnmock('@/components/setup/appTourContext');
  vi.doUnmock('@/components/setup/appTourSteps');
  vi.doUnmock('@/components/setup/AppIntroDialog');
  vi.doUnmock('@/components/BottomNav');
  vi.doUnmock('@/hooks/useNativePendingNavigation');
  vi.doUnmock('@/hooks/useNativeSync');
  vi.doUnmock('@/hooks/useStrictLockExpirySync');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('App Android-only shell', () => {
  it('renders the Android-only fallback when the native runtime is unavailable', async () => {
    vi.resetModules();

    vi.doMock('@/lib/platform', () => ({
      getPlatform: () => 'web',
      platform: 'web',
      isAndroidPlatform: false,
      isNativePlatform: false,
    }));
    vi.doMock('@/components/setup/AppTourProvider', () => ({
      AppTourProvider: ({ children }: { children: ReactNode; steps?: unknown[] }) => <>{children}</>,
    }));
    vi.doMock('@/components/setup/appTourContext', () => ({
      useAppTour: () => ({
        isOpen: false,
        currentStepId: null,
        openTour: vi.fn(),
      }),
    }));
    vi.doMock('@/components/setup/appTourSteps', () => ({
      APP_TOUR_STEPS: [],
    }));
    vi.doMock('@/components/setup/AppIntroDialog', () => ({
      default: () => null,
    }));
    vi.doMock('@/components/BottomNav', () => ({
      default: () => null,
    }));
    vi.doMock('@/hooks/useNativePendingNavigation', () => ({
      useNativePendingNavigation: () => ({ active: false, priming: false }),
    }));
    vi.doMock('@/hooks/useNativeSync', () => ({
      useNativeSync: () => undefined,
    }));
    vi.doMock('@/hooks/useStrictLockExpirySync', () => ({
      useStrictLockExpirySync: () => undefined,
    }));

    const { default: App } = await import('@/App');

    render(<App />);

    expect(screen.getByText(/blearn läuft jetzt nur noch als android-app/i)).toBeInTheDocument();
    expect(screen.getByText(/keine pwa-installation, keine demo-daten und keine desktop-fallback-flows mehr/i)).toBeInTheDocument();
  }, 10000);
});
