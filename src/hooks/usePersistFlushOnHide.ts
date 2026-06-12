import { useEffect } from 'react';
import { flushAllPersistStorage } from '@/lib/persistStorage';
import { clearReviewWal } from '@/modules/learning/store/reviewWriteAheadLog';

const LEARNING_PERSIST_KEY = 'blearn-learning-storage';

/**
 * Flushes all pending persist writes whenever the WebView is about to be
 * hidden, paused, or torn down. On Android (Capacitor) the WebView fires
 * `visibilitychange: hidden` / `pagehide` on every backgrounding and on
 * blocking-overlay teardown — exactly the moments where in-flight
 * IndexedDB writes of the serialized stores would otherwise be lost.
 *
 * Mount once at the app root.
 */
export function usePersistFlushOnHide() {
  useEffect(() => {
    let flushInFlight = false;

    const flush = (reason: string) => {
      if (flushInFlight) {
        return;
      }
      flushInFlight = true;

      void flushAllPersistStorage()
        .then(({ flushedKeys, timedOutKeys }) => {
          if (
            flushedKeys.includes(LEARNING_PERSIST_KEY)
            && !timedOutKeys.includes(LEARNING_PERSIST_KEY)
          ) {
            // The learning snapshot is durably committed; every WAL entry is
            // now redundant and can be dropped (Masterplan 2.2).
            clearReviewWal();
          }
          if (timedOutKeys.length > 0) {
            console.warn(
              `Persist flush (${reason}) incomplete; timed out:`,
              timedOutKeys,
            );
          } else if (flushedKeys.length > 0 && import.meta.env.DEV) {
            console.debug(`Persist flush (${reason}) completed:`, flushedKeys);
          }
        })
        .finally(() => {
          flushInFlight = false;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush('visibilitychange');
      }
    };

    const handlePageHide = () => {
      flush('pagehide');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, []);
}
