import { isAndroidPlatform } from '@/lib/platform';
import { grantManualOverride } from '@/services/screenTimeService';

type UnlockTargetType = 'app' | 'website' | 'search';

export async function primeNativeUnlockHandoff(
  targetId: string | null | undefined,
  targetType: UnlockTargetType,
  unlockDurationMinutes?: number | null,
) {
  const normalizedTargetId = targetId?.trim();
  if (!isAndroidPlatform || !normalizedTargetId) {
    return;
  }

  try {
    await grantManualOverride(normalizedTargetId, targetType, unlockDurationMinutes ?? undefined);
  } catch (error) {
    console.warn('Native unlock handoff priming failed:', error);
  }
}
