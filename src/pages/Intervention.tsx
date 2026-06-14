import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import InterventionOverlayScreen, {
  type InterventionBlockType,
  type InterventionMode,
} from '@/components/InterventionOverlayScreen';
import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';
import { useOverlayDismissGuard } from '@/hooks/useOverlayDismissGuard';
import { getBlockingFlowQueryContext } from '@/lib/blockingFlowContext';
import { waitForBlockingFlowPersistence } from '@/lib/blockingFlowPersistence';
import { primeNativeUnlockHandoff } from '@/lib/nativeUnlockHandoff';
import { createBlockingFlowSearchParams } from '@/lib/nativeOverlayRuntime';
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
    await abandonOverlaySession();
    const dismissed = await dismissOnce();
    if (!dismissed) {
      navigate('/', { replace: true });
    }
  };

  const handleReturnHome = async () => {
    await abandonOverlaySession();
    await dismissOnce();
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
      {successVisible ? (
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
            onPrimaryAction={() => void handlePrimaryAction()}
            onClose={() => void handleAbortOverlay()}
          />
        </>
      )}
    </div>
  );
}
