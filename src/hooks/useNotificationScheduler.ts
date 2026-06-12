import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { dispatchNotification, getNotificationPermissionState } from '@/services/notificationService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import type { NotificationChannelKey } from '@/plugins/ScreenTimePlugin';

const CATEGORY_COOLDOWN_MS: Record<NotificationChannelKey, number> = {
  reminders: 15 * 60 * 1000,
  statusHints: 3 * 60 * 1000,
  learnProgress: 90 * 1000,
  penaltyAlerts: 90 * 1000,
};

const MODE_LABELS: Record<string, string> = {
  normal: 'Normal',
  strict: 'Strict',
  reflection: 'Reflection',
  learn: 'Learn',
  penalty: 'Penalty',
  lock: 'Lock',
};

function formatModeLabel(mode: string) {
  return MODE_LABELS[mode] ?? mode;
}

type NotificationLearningSummary = {
  dueCount: number;
  overdueCount: number;
  primaryDeckName: string | null;
  latestUnlockGrantId: string | null;
  latestUnlockGrantTargetId: string | null;
  latestUnlockGrantGrantedAt: number | null;
  latestUnlockGrantExpiresAt: number | null;
};

type NotificationAppSummary = {
  appHydrated: boolean;
  notificationsEnabled: boolean;
  activeMode: string;
  statusHintsEnabled: boolean;
  remindersEnabled: boolean;
  learnProgressEnabled: boolean;
  penaltyAlertsEnabled: boolean;
  latestPenaltyTransactionId: string | null;
  latestPenaltyTransactionDeliveryStatus: 'processing' | 'sent' | 'failed' | null;
  latestPenaltyTransactionAmountSats: number | null;
  latestPenaltyTransactionTargetApp: string | null;
  latestPenaltyTransactionLastDeliveryError: string | null;
};

export function useNotificationScheduler(enabled: boolean) {
  const {
    appHydrated,
    notificationsEnabled,
    activeMode,
    statusHintsEnabled,
    remindersEnabled,
    learnProgressEnabled,
    penaltyAlertsEnabled,
    latestPenaltyTransactionId,
    latestPenaltyTransactionDeliveryStatus,
    latestPenaltyTransactionAmountSats,
    latestPenaltyTransactionTargetApp,
    latestPenaltyTransactionLastDeliveryError,
  } = useAppStore(
    useShallow((state): NotificationAppSummary => ({
      appHydrated: state.hasHydrated,
      notificationsEnabled: state.notificationsEnabled,
      activeMode: state.activeMode,
      statusHintsEnabled: state.notificationPreferences.statusHints,
      remindersEnabled: state.notificationPreferences.reminders,
      learnProgressEnabled: state.notificationPreferences.learnProgress,
      penaltyAlertsEnabled: state.notificationPreferences.penaltyAlerts,
      latestPenaltyTransactionId: state.penaltyTransactions[0]?.id ?? null,
      latestPenaltyTransactionDeliveryStatus: state.penaltyTransactions[0]?.deliveryStatus ?? null,
      latestPenaltyTransactionAmountSats: state.penaltyTransactions[0]?.amountSats ?? null,
      latestPenaltyTransactionTargetApp: state.penaltyTransactions[0]?.targetApp ?? null,
      latestPenaltyTransactionLastDeliveryError: state.penaltyTransactions[0]?.lastDeliveryError ?? null,
    })),
  );

  const {
    dueCount,
    overdueCount,
    primaryDeckName,
    latestUnlockGrantId,
    latestUnlockGrantTargetId,
    latestUnlockGrantGrantedAt,
    latestUnlockGrantExpiresAt,
  } = useLearningStore(
    useShallow((state): NotificationLearningSummary => {
      const allDecks = Object.values(state.decks);
      const orderedDecks = state.activeDeckId
        ? [
            ...allDecks.filter((deck) => deck.id === state.activeDeckId),
            ...allDecks.filter((deck) => deck.id !== state.activeDeckId),
          ]
        : allDecks;

      let nextDueCount = 0;
      let nextOverdueCount = 0;
      let nextPrimaryDeckName: string | null = null;

      for (const deck of orderedDecks) {
        const stats = state.getDeckStats(deck.id);
        if (!stats) {
          continue;
        }

        nextDueCount += stats.dueNowCount;
        nextOverdueCount += stats.overdueCount;
        if (!nextPrimaryDeckName && stats.dueNowCount > 0) {
          nextPrimaryDeckName = deck.name;
        }
      }

      const latestUnlockGrant = state.unlockGrants[0] ?? null;

      return {
        dueCount: nextDueCount,
        overdueCount: nextOverdueCount,
        primaryDeckName: nextPrimaryDeckName,
        latestUnlockGrantId: latestUnlockGrant?.id ?? null,
        latestUnlockGrantTargetId: latestUnlockGrant?.targetId ?? null,
        latestUnlockGrantGrantedAt: latestUnlockGrant?.grantedAt ?? null,
        latestUnlockGrantExpiresAt: latestUnlockGrant?.expiresAt ?? null,
      };
    }),
  );

  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');
  const [learningHydrated, setLearningHydrated] = useState(() => useLearningStore.persist.hasHydrated());
  const initializedRef = useRef(false);
  const lastSentAtRef = useRef<Record<NotificationChannelKey, number>>({
    reminders: 0,
    statusHints: 0,
    learnProgress: 0,
    penaltyAlerts: 0,
  });
  const previousModeRef = useRef(activeMode);
  const previousDueCountRef = useRef(0);
  const previousUnlockGrantIdRef = useRef<string | null>(latestUnlockGrantId);
  const previousPenaltySignatureRef = useRef<string | null>(null);
  const latestPenaltySignature = latestPenaltyTransactionId
    ? `${latestPenaltyTransactionId}:${latestPenaltyTransactionDeliveryStatus ?? 'processing'}`
    : null;

  useEffect(() => {
    let cancelled = false;

    getNotificationPermissionState()
      .then((state) => {
        if (!cancelled) {
          setPermissionState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionState('unsupported');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (useLearningStore.persist.hasHydrated()) {
      setLearningHydrated(true);
      return undefined;
    }

    return useLearningStore.persist.onFinishHydration(() => {
      setLearningHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!enabled || !appHydrated || !learningHydrated) {
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      previousModeRef.current = activeMode;
      previousDueCountRef.current = dueCount;
      previousUnlockGrantIdRef.current = latestUnlockGrantId;
      previousPenaltySignatureRef.current = latestPenaltySignature;
    }
  }, [activeMode, appHydrated, dueCount, enabled, latestPenaltySignature, latestUnlockGrantId, learningHydrated]);

  useEffect(() => {
    if (!enabled || !appHydrated || !learningHydrated || !initializedRef.current) {
      return;
    }

    if (!notificationsEnabled || permissionState !== 'granted') {
      previousModeRef.current = activeMode;
      previousDueCountRef.current = dueCount;
      previousUnlockGrantIdRef.current = latestUnlockGrantId;
      previousPenaltySignatureRef.current = latestPenaltySignature;
      return;
    }

    const maybeDispatch = async (
      category: NotificationChannelKey,
      title: string,
      body: string,
      gateEnabled: boolean,
    ) => {
      if (!gateEnabled) {
        return;
      }

      const now = Date.now();
      if (now - lastSentAtRef.current[category] < CATEGORY_COOLDOWN_MS[category]) {
        return;
      }

      const sent = await dispatchNotification({
        category,
        title,
        body,
        id: `blearn-${category}-${now}`,
      }).catch(() => false);

      if (sent) {
        lastSentAtRef.current[category] = now;
      }
    };

    if (previousModeRef.current !== activeMode) {
      const modeLabel = formatModeLabel(activeMode);
      const body =
        activeMode === 'normal'
          ? 'Alle Schutzmodi sind gerade pausiert.'
          : `${modeLabel} ist jetzt aktiv und beobachtet deine Regeln.`;
      void maybeDispatch('statusHints', `Modus: ${modeLabel}`, body, statusHintsEnabled);
      previousModeRef.current = activeMode;
    }

    if (previousDueCountRef.current === 0 && dueCount > 0) {
      const deckLabel = primaryDeckName ? ` in ${primaryDeckName}` : '';
      const overdueText = overdueCount > 0 ? `, ${overdueCount} davon ueberfaellig` : '';
      void maybeDispatch(
        'reminders',
        'Zeit fuer Learn',
        `${dueCount} Karten warten${deckLabel}${overdueText}.`,
        remindersEnabled,
      );
    }
    previousDueCountRef.current = dueCount;

    if (
      latestUnlockGrantId &&
      latestUnlockGrantTargetId &&
      latestUnlockGrantGrantedAt !== null &&
      latestUnlockGrantExpiresAt !== null &&
      previousUnlockGrantIdRef.current !== latestUnlockGrantId
    ) {
      const unlockMinutes = Math.max(
        1,
        Math.round((latestUnlockGrantExpiresAt - latestUnlockGrantGrantedAt) / 60_000),
      );
      void maybeDispatch(
        'learnProgress',
        'Freischaltung aktiv',
        `${latestUnlockGrantTargetId} ist jetzt fuer ${unlockMinutes} Min frei.`,
        learnProgressEnabled,
      );
      previousUnlockGrantIdRef.current = latestUnlockGrantId;
    }

    if (
      latestPenaltySignature &&
      previousPenaltySignatureRef.current !== latestPenaltySignature &&
      (latestPenaltyTransactionDeliveryStatus === 'sent' || latestPenaltyTransactionDeliveryStatus === 'failed')
    ) {
      const amountLabel = latestPenaltyTransactionAmountSats
        ? `${latestPenaltyTransactionAmountSats} sats`
        : 'eine Strafe';
      const title =
        latestPenaltyTransactionDeliveryStatus === 'sent'
          ? 'Penalty gesendet'
          : 'Penalty fehlgeschlagen';
      const body =
        latestPenaltyTransactionDeliveryStatus === 'sent'
          ? `${amountLabel} wurden fuer ${latestPenaltyTransactionTargetApp ?? 'eine Sperre'} ausgeloest.`
          : latestPenaltyTransactionLastDeliveryError || 'Die Penalty konnte nicht zugestellt werden.';
      void maybeDispatch('penaltyAlerts', title, body, penaltyAlertsEnabled);
      previousPenaltySignatureRef.current = latestPenaltySignature;
    } else {
      previousPenaltySignatureRef.current = latestPenaltySignature;
    }
  }, [
    activeMode,
    appHydrated,
    dueCount,
    learnProgressEnabled,
    latestPenaltySignature,
    latestPenaltyTransactionAmountSats,
    latestPenaltyTransactionDeliveryStatus,
    latestPenaltyTransactionLastDeliveryError,
    latestPenaltyTransactionTargetApp,
    latestUnlockGrantExpiresAt,
    latestUnlockGrantGrantedAt,
    latestUnlockGrantId,
    latestUnlockGrantTargetId,
    enabled,
    learningHydrated,
    overdueCount,
    penaltyAlertsEnabled,
    primaryDeckName,
    remindersEnabled,
    statusHintsEnabled,
    notificationsEnabled,
    permissionState,
  ]);
}
