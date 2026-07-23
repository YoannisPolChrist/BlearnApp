export type HapticFeedback = 'selection' | 'action' | 'success';

const HAPTIC_DURATIONS: Record<HapticFeedback, number> = {
  selection: 8,
  action: 12,
  success: 18,
};

/**
 * Small, optional Android-WebView haptics for intentional actions. This stays
 * silent on unsupported devices and follows the user's reduced-motion choice.
 */
export function triggerHapticFeedback(kind: HapticFeedback = 'selection') {
  if (
    typeof window === 'undefined'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  try {
    window.navigator.vibrate?.(HAPTIC_DURATIONS[kind]);
  } catch {
    // Vibration is optional feedback. A blocked browser or WebView must never
    // affect the user's action.
  }
}

// Named aliases keep learning-flow feedback declarative without introducing a
// second haptic implementation.
export const hapticTick = () => triggerHapticFeedback('selection');
export const hapticSuccess = () => triggerHapticFeedback('success');
