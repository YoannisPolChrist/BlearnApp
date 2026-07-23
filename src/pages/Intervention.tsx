import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import InterventionOverlayScreen, {
  type InterventionBlockType,
  type InterventionMode,
} from '@/components/InterventionOverlayScreen';
import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';
import { CoachRemoteBlockScreen } from '@/components/blocking/CoachRemoteBlockScreen';
import { useOverlayDismissGuard } from '@/hooks/useOverlayDismissGuard';
import { useI18n } from '@/hooks/useI18n';
import { getBlockingFlowQueryContext } from '@/lib/blockingFlowContext';
import { waitForBlockingFlowPersistence } from '@/lib/blockingFlowPersistence';
import { primeNativeUnlockHandoff } from '@/lib/nativeUnlockHandoff';
import { createBlockingFlowSearchParams } from '@/lib/nativeOverlayRuntime';
import { buildUnlockedTargetKey } from '@/lib/unlockedTargets';
import { abandonPendingNavigation } from '@/services/screenTimeService';
import { useModeSettings, usePenaltyActions, usePenaltyStatus } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';

function parsePositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function InterventionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blockingFlow = getBlockingFlowQueryContext(searchParams);
  const { interventionPatternId } = useModeSettings();
  const { penaltyAmountSats, accountabilityPartner, penaltyEnabled } = usePenaltyStatus();
  const { deductPenalty } = usePenaltyActions();
  const { unlockTarget } = useAppStore();

  const { t, locale } = useI18n();
  const remoteBlockingInstruction = useAppStore((state) => state.remoteBlockingInstruction);
  const resolvedRemoteBlockedApps = useAppStore((state) => state.resolvedRemoteBlockedApps);

  const [penaltyConfirmStep, setPenaltyConfirmStep] = useState<1 | 2>(1);
  const [penaltyBusy, setPenaltyBusy] = useState(false);
  // Synchroner Reentrancy-Schutz: `penaltyBusy` (React-State) wird erst beim
  // naechsten Render wirksam, sodass ein sehr schneller Doppel-Tap die Zahlung
  // zweimal ausloesen koennte (Doppelbelastung). Der Ref blockt den zweiten
  // Aufruf sofort, noch bevor `disabled` greift.
  const paymentInFlightRef = useRef(false);
  const [penaltyErrorMessage, setPenaltyErrorMessage] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successHandled, setSuccessHandled] = useState(false);

  const targetId = blockingFlow.targetId || '';
  const targetLabel = blockingFlow.targetLabel || targetId;

  const isRemoteBlocked = useMemo(() => {
    return resolvedRemoteBlockedApps.includes(targetId.toLowerCase());
  }, [resolvedRemoteBlockedApps, targetId]);

  // Waehrend des Blocking-Flows sind die GlobalRuntimeManagers (und damit der
  // Expiry-Timeout von useRemoteBlockingSync) deaktiviert. Ohne eigenen Ticker
  // wuerde der Ablauf der Coach-Sperre hier nie einen Re-Render ausloesen:
  // weder Auto-Dismiss noch der Countdown wuerden reagieren.
  const [remoteBlockTick, setRemoteBlockTick] = useState(0);

  useEffect(() => {
    if (!remoteBlockingInstruction) {
      return undefined;
    }

    const remainingMs = remoteBlockingInstruction.expiresAt - Date.now();
    if (remainingMs <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemoteBlockTick((tick) => tick + 1);
    }, 30_000);
    const timeout = window.setTimeout(() => {
      setRemoteBlockTick((tick) => tick + 1);
    }, Math.min(remainingMs + 250, 2 ** 31 - 1));

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [remoteBlockingInstruction]);

  const isCurrentlyRemoteBlocked = Boolean(
    isRemoteBlocked &&
      remoteBlockingInstruction &&
      remoteBlockingInstruction.expiresAt > Date.now()
  );

  const remoteBlockDetails = useMemo(() => {
    // An den Live-Zustand koppeln: Nach Ablauf darf der Coach-Titel nicht mehr
    // den regulaeren Overlay-Text ueberschreiben.
    if (!isCurrentlyRemoteBlocked || !remoteBlockingInstruction) {
      return null;
    }

    const expiresAt = remoteBlockingInstruction.expiresAt;
    const date = new Date(expiresAt);
    const timeString = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const diffMs = expiresAt - Date.now();
    const diffMins = Math.max(0, Math.ceil(diffMs / 60_000));

    return {
      title: t('remoteBlocking.overlay.title'),
      description: t('remoteBlocking.overlay.description', { time: timeString, minutes: diffMins }),
    };
    // remoteBlockTick haelt den Countdown aktuell, obwohl er im Body nicht vorkommt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentlyRemoteBlocked, remoteBlockingInstruction, locale, t, remoteBlockTick]);

  const rawMode = searchParams.get('mode');
  const mode: InterventionMode = rawMode === 'learn'
    || rawMode === 'penalty'
    || rawMode === 'lock'
    || rawMode === 'reflection'
    || rawMode === 'strict'
    ? rawMode
    : 'strict';
  const blockType = blockingFlow.targetType as InterventionBlockType;
  const overlaySessionId = blockingFlow.overlaySessionId || '';
  const unlockDurationMinutes = parsePositiveInteger(searchParams.get('unlockDurationMinutes'));
  const { dismissOnce } = useOverlayDismissGuard({
    active: Boolean(overlaySessionId),
    autoDismissOnUnmount: Boolean(overlaySessionId) && mode === 'penalty',
    overlaySessionId,
  });

  const blockedApps = useAppStore((state) => state.blockedApps);
  const blockedAppModes = useAppStore((state) => state.blockedAppModes);
  const blockedWebsites = useAppStore((state) => state.blockedWebsites);
  const blockedWebsiteModes = useAppStore((state) => state.blockedWebsiteModes);
  const blockedSearchTerms = useAppStore((state) => state.blockedSearchTerms);
  const blockedSearchTermModes = useAppStore((state) => state.blockedSearchTermModes);
  const strictLockUntil = useAppStore((state) => state.strictLockUntil);
  const strictLockScope = useAppStore((state) => state.strictLockScope);
  const unlockedTargets = useAppStore((state) => state.unlockedTargets);

  const isUnlocked = useMemo(() => {
    const key = buildUnlockedTargetKey(targetId, blockType);
    if (!key) return false;
    const expiry = unlockedTargets[key];
    return expiry ? Date.now() < expiry : false;
  }, [unlockedTargets, targetId, blockType]);

  const isBlockedLocally = useMemo(() => {
    if (!targetId) return false;
    if (isUnlocked) return false;

    if (blockType === 'app') {
      const normalized = targetId.toLowerCase();

      const isFullStrictLockActive = strictLockUntil !== null &&
        Date.now() < strictLockUntil &&
        strictLockScope === 'full';
      if (isFullStrictLockActive) {
        return true;
      }

      const hasLocalBlock = blockedApps.some((app) => app.toLowerCase() === normalized) &&
        Boolean(blockedAppModes[normalized]);
      if (hasLocalBlock) {
        return true;
      }
    } else if (blockType === 'website') {
      const normalized = targetId.toLowerCase();
      const hasLocalBlock = blockedWebsites.some((site) => site.toLowerCase() === normalized) &&
        Boolean(blockedWebsiteModes[normalized]);
      if (hasLocalBlock) {
        return true;
      }
    } else if (blockType === 'search') {
      const normalized = targetId.toLowerCase();
      const hasLocalBlock = blockedSearchTerms.some((term) => term.toLowerCase() === normalized) &&
        Boolean(blockedSearchTermModes[normalized]);
      if (hasLocalBlock) {
        return true;
      }
    }

    return false;
  }, [
    targetId,
    blockType,
    isUnlocked,
    blockedApps,
    blockedAppModes,
    blockedWebsites,
    blockedWebsiteModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    strictLockUntil,
    strictLockScope,
  ]);

  const wasRemoteBlockedRef = useRef(false);

  useEffect(() => {
    if (isCurrentlyRemoteBlocked) {
      wasRemoteBlockedRef.current = true;
    }
  }, [isCurrentlyRemoteBlocked]);

  useEffect(() => {
    if (wasRemoteBlockedRef.current && !isCurrentlyRemoteBlocked && !isBlockedLocally) {
      void dismissOnce()
        .then((dismissed) => {
          if (!dismissed) {
            navigate('/', { replace: true });
          }
        })
        .catch((error) => {
          console.warn('[Intervention] Auto-dismiss failed, falling back to home route:', error);
          navigate('/', { replace: true });
        });
    }
  }, [isCurrentlyRemoteBlocked, isBlockedLocally, dismissOnce, navigate]);
  const penaltyAmountLabel = useMemo(
    () => `${(penaltyAmountSats || 0).toLocaleString('de-DE')} sats`,
    [penaltyAmountSats],
  );
  const successTone = mode === 'penalty'
    ? 'penalty'
    : mode === 'learn'
      ? 'learn'
      : mode === 'reflection' || mode === 'strict'
        ? 'reflection'
        : 'strict';
  const abandonOverlaySession = async () => {
    await abandonPendingNavigation(overlaySessionId || undefined).catch((error) => {
      console.warn('Pending navigation abandon failed:', error);
    });
  };

  const launchStrictFlow = async () => {
    const params = createBlockingFlowSearchParams(searchParams);
    if (interventionPatternId) {
      params.set('patternId', interventionPatternId);
    }

    navigate(`/breathing?${params.toString()}`, { replace: true });
  };

  const handlePenaltySuccess = () => {
    if (!targetId) {
      toast.error('Das Ziel für die Freigabe konnte nicht geladen werden.');
      return;
    }

    unlockTarget(targetId, blockType, unlockDurationMinutes ?? undefined);
    setSuccessVisible(true);
  };

  const handleAbortOverlay = async () => {
    try {
      await abandonOverlaySession();
      const dismissed = await dismissOnce(true);
      if (!dismissed) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.warn('Intervention abort overlay failed:', error);
    }
  };

  const handleReturnHome = async () => {
    try {
      await abandonOverlaySession();
      await dismissOnce(true);
    } catch (error) {
      console.warn('Intervention return home failed:', error);
    }
    navigate('/', { replace: true });
  };

  const handlePrimaryAction = async () => {
    if (mode === 'lock') {
      await handleReturnHome();
      return;
    }

    if (mode === 'learn') {
      const params = createBlockingFlowSearchParams(searchParams);
      navigate(`/learn/review?${params.toString()}`, { replace: true });
      return;
    }

    if (mode === 'reflection' || mode === 'strict') {
      await launchStrictFlow();
      return;
    }

    if (mode !== 'penalty' || !penaltyEnabled || !targetId) {
      navigate('/', { replace: true });
      return;
    }

    if (penaltyConfirmStep === 1) {
      setPenaltyErrorMessage(null);
      setPenaltyConfirmStep(2);
      return;
    }

    // Zweiter, synchroner Tap-Schutz vor `setPenaltyBusy`: verhindert, dass ein
    // Doppel-Tap auf "Jetzt bezahlen" `deductPenalty` ein zweites Mal startet,
    // bevor der State-Update den Button deaktiviert hat.
    if (paymentInFlightRef.current) {
      return;
    }
    paymentInFlightRef.current = true;

    setPenaltyBusy(true);
    setPenaltyErrorMessage(null);

    try {
      await deductPenalty(targetId, blockType);
      handlePenaltySuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Die Strafzahlung ist fehlgeschlagen.';
      setPenaltyErrorMessage(message);
      toast.error(message);
    } finally {
      setPenaltyBusy(false);
      paymentInFlightRef.current = false;
    }
  };

  const handleSuccessDone = async () => {
    if (successHandled) {
      return;
    }

    setSuccessHandled(true);
    setSuccessVisible(false);
    
    try {
      await waitForBlockingFlowPersistence();
    } catch (error) {
      console.warn('Penalty overlay persistence did not settle before dismissing the blocking flow:', error);
    }
    await primeNativeUnlockHandoff(targetId, blockType, unlockDurationMinutes);
    const dismissed = await dismissOnce();
    if (!dismissed) {
      navigate('/', { replace: true });
    }
  };


  return (
    <div className="min-h-screen bg-background">
      {isCurrentlyRemoteBlocked ? (
        <CoachRemoteBlockScreen
          onReturnHome={handleReturnHome}
          targetId={targetId}
          targetLabel={targetLabel}
          targetType={blockType}
          expiresAt={remoteBlockingInstruction.expiresAt}
        />
      ) : successVisible ? (
        <BlockingUnlockSuccessScreen
          buttonLabel={targetId ? 'App freischalten' : 'Zum Dashboard'}
          onContinue={handleSuccessDone}
          targetId={targetId || undefined}
          targetLabel={targetLabel || undefined}
          targetType={blockType}
          tone={successTone}
          unlockDurationMinutes={unlockDurationMinutes}
        />
      ) : (
        <>
          <InterventionOverlayScreen
            open
            blockedTarget={targetLabel || targetId || null}
            blockType={blockType}
            mode={mode}
            penaltyAmountLabel={penaltyAmountLabel}
            recipientLabel={accountabilityPartner?.name || 'deinen Accountability-Partner'}
            penaltyConfirmStep={penaltyConfirmStep}
            penaltyBusy={penaltyBusy}
            penaltyErrorMessage={penaltyErrorMessage || undefined}
            unlockDurationMinutes={unlockDurationMinutes}
            closeLabel="Abbrechen"
            titleOverride={remoteBlockDetails?.title}
            descriptionOverride={remoteBlockDetails?.description}
            onPrimaryAction={() => void handlePrimaryAction()}
            onClose={() => void handleAbortOverlay()}
          />
        </>
      )}
    </div>
  );
}
