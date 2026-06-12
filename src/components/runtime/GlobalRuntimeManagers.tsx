import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppProgressCloudSync } from '@/hooks/useAppProgressCloudSync';
import { useLearningBackgroundRuntime } from '@/hooks/useLearningBackgroundRuntime';
import { useLearningCloudSync, useLearningStoreRehydration } from '@/hooks/useLearningCloudSync';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { useNativeSync } from '@/hooks/useNativeSync';
import { useStrictLockExpirySync } from '@/hooks/useStrictLockExpirySync';
import { isAndroidPlatform } from '@/lib/platform';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

const NotificationPermissionPrompt = lazy(() => import('@/components/settings/NotificationPermissionPrompt'));
const allowWebRuntime = import.meta.env.VITE_ALLOW_WEB_RUNTIME === 'true';

function ThemeRuntimeManager() {
  useStrictLockExpirySync();
  return null;
}
ThemeRuntimeManager.displayName = 'ThemeRuntimeManager';

function NativePolicySyncRuntime() {
  useNativeSync();
  return null;
}
NativePolicySyncRuntime.displayName = 'NativePolicySyncRuntime';

function NativePolicyRuntimeManager() {
  const appHydrated = useAppStore((state) => state.hasHydrated);
  const authReady = useAuthStore((state) => state.authReady);
  const status = useAuthStore((state) => state.status);
  const [learningHydrated, setLearningHydrated] = useState(() => useLearningStore.persist.hasHydrated());

  useEffect(() => {
    if (useLearningStore.persist.hasHydrated()) {
      setLearningHydrated(true);
      return undefined;
    }

    return useLearningStore.persist.onFinishHydration(() => {
      setLearningHydrated(true);
    });
  }, []);

  const authEnabled = status !== 'disabled';
  const shouldRun = appHydrated && learningHydrated && (!isAndroidPlatform || !authEnabled || authReady);

  return shouldRun ? <NativePolicySyncRuntime /> : null;
}
NativePolicyRuntimeManager.displayName = 'NativePolicyRuntimeManager';

function NotificationRuntimeManager() {
  useNotificationScheduler(isAndroidPlatform || allowWebRuntime);
  return null;
}
NotificationRuntimeManager.displayName = 'NotificationRuntimeManager';

function AuthRuntimeManager() {
  const initialize = useAuthStore((state) => state.initialize);
  const authDialogOpen = useAuthStore((state) => state.authDialogOpen);
  const authReady = useAuthStore((state) => state.authReady);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (authReady || status === 'checking' || status === 'disabled') {
      return undefined;
    }

    if (authDialogOpen) {
      initialize();
      return undefined;
    }

    let cancelled = false;
    const startInitialization = () => {
      if (!cancelled) {
        initialize();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleHandle = window.requestIdleCallback(startInitialization, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleHandle);
      };
    }

    const timerId = window.setTimeout(startInitialization, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [authDialogOpen, authReady, initialize, status]);

  return null;
}
AuthRuntimeManager.displayName = 'AuthRuntimeManager';

function LearningCloudRuntimeManager({ remoteEnabled }: { remoteEnabled: boolean }) {
  const runtimeEnabled = isAndroidPlatform || allowWebRuntime;

  useLearningStoreRehydration(runtimeEnabled);
  useLearningCloudSync(runtimeEnabled && remoteEnabled);
  useAppProgressCloudSync(runtimeEnabled && remoteEnabled);
  // Keep media/runtime helpers, but do not run a second learning cloud merge loop
  // in parallel with the Firestore-backed sync authority.
  useLearningBackgroundRuntime(runtimeEnabled && remoteEnabled, { syncEnabled: false });
  return null;
}
LearningCloudRuntimeManager.displayName = 'LearningCloudRuntimeManager';

export default function GlobalRuntimeManagers({ enabled }: { enabled: boolean }) {
  const authStatus = useAuthStore((state) => state.status);

  return (
    <>
      {enabled ? (
        <>
          <AuthRuntimeManager />
          <LearningCloudRuntimeManager remoteEnabled={authStatus === 'authenticated'} />
          <ThemeRuntimeManager />
          <NativePolicyRuntimeManager />
          <NotificationRuntimeManager />
          <Suspense fallback={null}>
            <NotificationPermissionPrompt />
          </Suspense>
        </>
      ) : null}
    </>
  );
}
GlobalRuntimeManagers.displayName = 'GlobalRuntimeManagers';
