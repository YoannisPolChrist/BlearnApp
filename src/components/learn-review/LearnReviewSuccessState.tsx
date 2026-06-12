import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';

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
  return (
    <BlockingUnlockSuccessScreen
      buttonLabel={targetId ? 'Zur App' : 'Zum Dashboard'}
      onContinue={onContinueToTarget}
      reduceInterfaceMotion={reduceInterfaceMotion}
      targetId={targetId}
      targetLabel={targetId ? blockedTargetLabel : 'Learn abgeschlossen'}
      targetType={targetType}
      tone="learn"
      unlockDurationMinutes={targetId ? unlockDurationMinutes : null}
    />
  );
}
