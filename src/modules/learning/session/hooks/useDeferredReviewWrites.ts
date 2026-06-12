import { useCallback, useEffect, useRef } from 'react';

export function useDeferredReviewWrites() {
  const deferredWriteQueueRef = useRef<Array<() => void>>([]);
  const deferredWriteTimerRef = useRef<number | null>(null);

  const flushDeferredWrites = useCallback(() => {
    deferredWriteTimerRef.current = null;
    const nextTasks = deferredWriteQueueRef.current.splice(0);
    for (const task of nextTasks) {
      task();
    }
  }, []);

  const enqueueDeferredWrite = useCallback(
    (task: () => void) => {
      deferredWriteQueueRef.current.push(task);
      if (deferredWriteTimerRef.current !== null) {
        return;
      }

      deferredWriteTimerRef.current = window.setTimeout(flushDeferredWrites, 0);
    },
    [flushDeferredWrites],
  );

  const runPendingReviewWrites = useCallback(() => {
    if (deferredWriteTimerRef.current !== null) {
      window.clearTimeout(deferredWriteTimerRef.current);
      deferredWriteTimerRef.current = null;
    }

    flushDeferredWrites();
  }, [flushDeferredWrites]);

  useEffect(
    () => () => {
      if (deferredWriteTimerRef.current !== null) {
        window.clearTimeout(deferredWriteTimerRef.current);
        deferredWriteTimerRef.current = null;
      }

      const pendingTasks = deferredWriteQueueRef.current.splice(0);
      for (const task of pendingTasks) {
        task();
      }
    },
    [],
  );

  return {
    enqueueDeferredWrite,
    runPendingReviewWrites,
  };
}
