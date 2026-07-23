import { useEffect } from 'react';
import { flushAllPersistStorage } from '@/lib/persistStorage';
import { clearReviewWal, replayReviewWal } from '@/modules/learning/store/reviewWriteAheadLog';
import { useLearningStore } from '@/store/useLearningStore';
import { useAppStore } from '@/store/useAppStore';

const LEARNING_PERSIST_KEY = 'blearn-learning-storage';

/**
 * Flushes all pending persist writes whenever the WebView is about to be
 * hidden, paused, or torn down. On Android (Capacitor) the WebView fires
 * `visibilitychange: hidden` / `pagehide` on every backgrounding and on
 * blocking-overlay teardown — exactly the moments where in-flight
 * IndexedDB writes of the serialized stores would otherwise be lost.
 *
 * It also automatically rehydrates the stores and replays the WAL when the
 * WebView becomes visible or gains focus, ensuring multiple WebView processes
 * (main app and blocking overlay) stay in sync.
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
          if (flushedKeys.includes(LEARNING_PERSIST_KEY)) {
            // The learning store was successfully flushed from memory to disk.
            // That means the database snapshot now includes all local reviews
            // completed during this session, rendering the WAL redundant for
            // this instance.
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

    const rehydrateAndReplay = () => {
      void Promise.all([
        useLearningStore.persist.rehydrate(),
        useAppStore.persist.rehydrate(),
      ])
        .then(() => {
          try {
            replayReviewWal(useLearningStore);
          } catch (error) {
            console.warn('Review-WAL replay failed on restore:', error);
          }
        })
        .catch((error) => {
          console.warn('Failed to rehydrate stores on restore:', error);
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush('visibilitychange');
      } else if (document.visibilityState === 'visible') {
        rehydrateAndReplay();
      }
    };

    const handlePageHide = () => {
      flush('pagehide');
    };

    const handleWindowFocus = () => {
      rehydrateAndReplay();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
}

