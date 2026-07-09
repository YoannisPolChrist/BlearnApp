import { useEffect, useRef } from 'react';
import { isFirebaseConfigured, isFirebaseWriteEnabled } from '@/lib/firebase';
import { getFcmToken } from '@/services/screenTimeService';
import { registerDeviceFcmToken } from '@/services/firebaseProgressSyncService';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Publishes this device's FCM token to Firestore so the Hermes coach server can
 * push remote-block instructions that engage even while the app is closed.
 * Runs once per (user, token) — the token is stable across launches, so the
 * write is skipped on repeat mounts.
 */
export function useFcmTokenRegistration() {
  const authUserId = useAuthStore((state) => state.user?.uid);
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const remoteBlockingEnabled = useAppStore((state) => state.remoteBlockingEnabled);

  const registeredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !remoteBlockingEnabled
      || !isFirebaseConfigured()
      || !isFirebaseWriteEnabled()
      || !authReady
      || authStatus !== 'authenticated'
      || !authUserId
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getFcmToken();
        if (cancelled || !token) {
          return;
        }
        const registrationKey = `${authUserId}:${token}`;
        if (registeredKeyRef.current === registrationKey) {
          return;
        }
        await registerDeviceFcmToken(authUserId, token);
        if (!cancelled) {
          registeredKeyRef.current = registrationKey;
        }
      } catch (error) {
        console.warn('[FcmTokenRegistration] Failed to register device token:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUserId, authReady, authStatus, remoteBlockingEnabled]);
}
