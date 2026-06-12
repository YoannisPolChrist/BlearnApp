export function formatUnlockDurationLabel(unlockDurationMinutes?: number | null) {
  if (
    typeof unlockDurationMinutes !== 'number'
    || !Number.isFinite(unlockDurationMinutes)
    || unlockDurationMinutes <= 0
  ) {
    return null;
  }

  return `${unlockDurationMinutes} Min frei`;
}
