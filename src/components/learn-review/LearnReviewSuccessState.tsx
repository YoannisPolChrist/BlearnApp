import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';

interface LearnReviewSuccessStateProps {
  blockedTargetLabel: string;
  onContinueToTarget: () => void | Promise<void>;
  reduceInterfaceMotion: boolean;
  targetId?: string;
  targetType: 'app' | 'website' | 'search';
  unlockDurationMinutes: number;
}

export function LearnReviewSuccessState({
  blockedTargetLabel,
  onContinueToTarget,
  reduceInterfaceMotion,
  targetId,
  targetType,
  unlockDurationMinutes,
}: LearnReviewSuccessStateProps) {
  if (!targetId) {
    return (
      <BlockingUnlockSuccessScreen
        buttonLabel="Zum Dashboard"
        onContinue={onContinueToTarget}
        reduceInterfaceMotion={reduceInterfaceMotion}
        targetId={targetId}
        targetLabel="Learn abgeschlossen"
        targetType={targetType}
        tone="learn"
        unlockDurationMinutes={null}
      />
    );
  }

  return (
    <SuccessAnimation
      visible={true}
      message={blockedTargetLabel}
      subMessage={`Freigeschaltet für ${unlockDurationMinutes} Min.`}
      onAnimationDone={onContinueToTarget}
    />
  );
}
