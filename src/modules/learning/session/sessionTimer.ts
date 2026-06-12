import type { LearningSessionTimerSnapshot } from './sessionTypes';

export interface SessionTimerCallbacks {
  onTick?: (snapshot: LearningSessionTimerSnapshot) => void;
  onLimit?: (snapshot: LearningSessionTimerSnapshot) => void;
}

export interface SessionTimerOptions extends SessionTimerCallbacks {
  limitMs?: number;
  now?: () => number;
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
}

function defaultSchedule(callback: () => void) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(callback, 16);
}

function defaultCancel(handle: number) {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
    return;
  }

  globalThis.clearTimeout(handle);
}

export class SessionTimer {
  private readonly now: () => number;
  private readonly schedule: (callback: () => void) => number;
  private readonly cancel: (handle: number) => void;
  private readonly onTick?: (snapshot: LearningSessionTimerSnapshot) => void;
  private readonly onLimit?: (snapshot: LearningSessionTimerSnapshot) => void;
  private handle: number | null = null;
  private snapshot: LearningSessionTimerSnapshot;

  constructor(options: SessionTimerOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? defaultSchedule;
    this.cancel = options.cancel ?? defaultCancel;
    this.onTick = options.onTick;
    this.onLimit = options.onLimit;
    this.snapshot = {
      isRunning: false,
      isPaused: false,
      elapsedMs: 0,
      limitMs: options.limitMs,
    };
  }

  private emitTick() {
    this.onTick?.(this.getSnapshot());
  }

  private clearScheduled() {
    if (this.handle !== null) {
      this.cancel(this.handle);
      this.handle = null;
    }
  }

  private runLoop = () => {
    if (!this.snapshot.isRunning || this.snapshot.isPaused) {
      return;
    }

    const startedAt = this.snapshot.startedAt ?? this.now();
    this.snapshot = {
      ...this.snapshot,
      elapsedMs: this.now() - startedAt,
    };
    this.emitTick();

    if (typeof this.snapshot.limitMs === 'number' && this.snapshot.elapsedMs >= this.snapshot.limitMs) {
      this.snapshot = {
        ...this.snapshot,
        isRunning: false,
        isPaused: false,
      };
      this.clearScheduled();
      this.onLimit?.(this.getSnapshot());
      return;
    }

    this.handle = this.schedule(this.runLoop);
  };

  getSnapshot(): LearningSessionTimerSnapshot {
    return { ...this.snapshot };
  }

  setLimitMs(limitMs?: number) {
    this.snapshot = {
      ...this.snapshot,
      limitMs,
    };
    this.emitTick();
  }

  start(now = this.now()) {
    this.clearScheduled();
    this.snapshot = {
      ...this.snapshot,
      isRunning: true,
      isPaused: false,
      elapsedMs: 0,
      startedAt: now,
      pausedAt: undefined,
    };
    this.emitTick();
    this.handle = this.schedule(this.runLoop);
  }

  pause(now = this.now()) {
    if (!this.snapshot.isRunning || this.snapshot.isPaused) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      isPaused: true,
      elapsedMs: now - (this.snapshot.startedAt ?? now),
      pausedAt: now,
    };
    this.clearScheduled();
    this.emitTick();
  }

  resume(now = this.now()) {
    if (!this.snapshot.isRunning || !this.snapshot.isPaused) {
      return;
    }

    const pausedElapsed = this.snapshot.elapsedMs;
    this.snapshot = {
      ...this.snapshot,
      isPaused: false,
      startedAt: now - pausedElapsed,
      pausedAt: undefined,
    };
    this.emitTick();
    this.handle = this.schedule(this.runLoop);
  }

  stop(now = this.now()) {
    const startedAt = this.snapshot.startedAt ?? now;
    this.snapshot = {
      ...this.snapshot,
      isRunning: false,
      isPaused: false,
      elapsedMs: this.snapshot.startedAt ? now - startedAt : this.snapshot.elapsedMs,
      startedAt: undefined,
      pausedAt: undefined,
    };
    this.clearScheduled();
    this.emitTick();
  }

  destroy() {
    this.clearScheduled();
  }
}
