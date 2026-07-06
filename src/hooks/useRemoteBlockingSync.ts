import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { subscribeToRemoteBlockingInstruction } from '@/services/firebaseProgressSyncService';
import { isFirebaseConfigured } from '@/lib/firebase';

export function useRemoteBlockingSync() {
  const authUserId = useAuthStore((state) => state.user?.uid);
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const firebaseConfigured = isFirebaseConfigured();

  const remoteBlockingEnabled = useAppStore((state) => state.remoteBlockingEnabled);
  const setRemoteBlockingInstruction = useAppStore((state) => state.setRemoteBlockingInstruction);
  const remoteBlockingInstruction = useAppStore((state) => state.remoteBlockingInstruction);

  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // 1. Listen to Firestore when authenticated & remote control is enabled
  useEffect(() => {
    if (!remoteBlockingEnabled) {
      void setRemoteBlockingInstruction(null);
      return undefined;
    }

    if (
      !firebaseConfigured ||
      authStatus === 'disabled' ||
      !authReady ||
      !authUserId
    ) {
      return undefined;
    }

    const unsubscribe = subscribeToRemoteBlockingInstruction(
      authUserId,
      (instruction) => {
        void setRemoteBlockingInstruction(instruction);
      },
      (error) => {
        console.warn('[RemoteBlockingSync] Subscription failed:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [
    authUserId,
    authReady,
    authStatus,
    firebaseConfigured,
    remoteBlockingEnabled,
    setRemoteBlockingInstruction,
  ]);

  // 2. Set up the dynamic timeout to clear expired instructions
  useEffect(() => {
    clearTimer();

    if (!remoteBlockingInstruction) return;

    const now = Date.now();
    const expiresAt = remoteBlockingInstruction.expiresAt;

    if (now >= expiresAt) {
      // Already expired
      void setRemoteBlockingInstruction(null);
      return;
    }

    // setTimeout-Delays > 2^31-1 ms (~24,8 Tage) feuern sofort — das wuerde die
    // Sperre unmittelbar loeschen statt sie ablaufen zu lassen.
    const delay = Math.min(expiresAt - now, 2 ** 31 - 1);
    timeoutRef.current = window.setTimeout(() => {
      void setRemoteBlockingInstruction(null);
    }, delay);

    return () => {
      clearTimer();
    };
  }, [remoteBlockingInstruction, setRemoteBlockingInstruction]);
}
