import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { MAX_STRICT_LOCK_DURATION_MS } from '@/lib/strictLockLimits';

describe('strict lock store enforcement (requirement: max 20h, settings immutable)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it('caps the strict lock at 20 hours even for a longer configured window', () => {
    // 23-hour overnight window: 08:00 → 07:00 next day.
    useAppStore.getState().setStrictSchedule('08:00', '07:00');

    const activationTime = new Date();
    activationTime.setHours(9, 0, 0, 0); // inside the window
    vi.spyOn(Date, 'now').mockReturnValue(activationTime.getTime());
    // activateStrictLock uses `new Date()` for window math — pin it too.
    vi.useFakeTimers({ now: activationTime.getTime(), toFake: ['Date'] });

    useAppStore.getState().activateStrictLock();

    const { strictLockUntil } = useAppStore.getState();
    expect(strictLockUntil).not.toBeNull();
    expect(strictLockUntil! - activationTime.getTime()).toBeLessThanOrEqual(
      MAX_STRICT_LOCK_DURATION_MS,
    );

    vi.useRealTimers();
  });

  it('keeps locks shorter than 20 hours untouched', () => {
    useAppStore.getState().setStrictSchedule('08:00', '17:00');

    const activationTime = new Date();
    activationTime.setHours(9, 0, 0, 0);
    vi.useFakeTimers({ now: activationTime.getTime(), toFake: ['Date'] });

    useAppStore.getState().activateStrictLock();

    const expectedEnd = new Date(activationTime);
    expectedEnd.setHours(17, 0, 0, 0);
    expect(useAppStore.getState().strictLockUntil).toBe(expectedEnd.getTime());

    vi.useRealTimers();
  });

  it('refuses schedule changes while the strict lock is running', () => {
    useAppStore.getState().setStrictSchedule('08:00', '17:00');

    const activationTime = new Date();
    activationTime.setHours(9, 0, 0, 0);
    vi.useFakeTimers({ now: activationTime.getTime(), toFake: ['Date'] });

    useAppStore.getState().activateStrictLock();
    expect(useAppStore.getState().isStrictLocked()).toBe(true);

    // Attempting to shrink the window mid-lock must be a no-op.
    useAppStore.getState().setStrictSchedule('09:00', '09:30');

    expect(useAppStore.getState().strictStartTime).toBe('08:00');
    expect(useAppStore.getState().strictEndTime).toBe('17:00');

    vi.useRealTimers();
  });

  it('allows schedule changes again after the lock has expired', () => {
    useAppStore.getState().setStrictSchedule('08:00', '10:00');

    const activationTime = new Date();
    activationTime.setHours(9, 0, 0, 0);
    vi.useFakeTimers({ now: activationTime.getTime(), toFake: ['Date'] });

    useAppStore.getState().activateStrictLock();
    expect(useAppStore.getState().isStrictLocked()).toBe(true);

    // Jump past the lock end.
    const afterLock = new Date(activationTime);
    afterLock.setHours(10, 1, 0, 0);
    vi.setSystemTime(afterLock.getTime());

    useAppStore.getState().setStrictSchedule('06:00', '12:00');
    expect(useAppStore.getState().strictStartTime).toBe('06:00');
    expect(useAppStore.getState().strictEndTime).toBe('12:00');

    vi.useRealTimers();
  });
});
