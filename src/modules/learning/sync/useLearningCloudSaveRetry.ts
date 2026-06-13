import { useEffect } from 'react';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import { flushLearningCloudSaveIfAvailable } from '@/lib/learningCloudImmediateSave';

const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

/**
 * Masterplan 3.6: Kein Sync-Fehler wird nur nach console.warn geschluckt.
 * Solange der Learning-Sync im Fehlerzustand ist, wird mit exponentiellem
 * Backoff erneut gespeichert — zusätzlich sofort bei Netz-Rückkehr und wenn
 * die App wieder sichtbar wird. Erfolg beendet die Schleife über den
 * Statuswechsel (error → ready) im Runtime-Store.
 */
export function useLearningCloudSaveRetry(enabled = true) {
  const status = useCloudSyncRuntimeStore((state) => state.learning.status);

  useEffect(() => {
    if (!enabled || status !== 'error') {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    void (async () => {
      let attempt = 0;
      while (!cancelled) {
        await sleep(Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** attempt));
        if (cancelled || useCloudSyncRuntimeStore.getState().learning.status !== 'error') {
          return;
        }
        const saved = await flushLearningCloudSaveIfAvailable(`error_backoff_retry_${attempt + 1}`);
        if (saved) {
          return;
        }
        attempt += 1;
      }
    })();

    const retryNowIfFailing = () => {
      if (useCloudSyncRuntimeStore.getState().learning.status === 'error') {
        void flushLearningCloudSaveIfAvailable('connectivity_recovered_retry');
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        retryNowIfFailing();
      }
    };
    window.addEventListener('online', retryNowIfFailing);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener('online', retryNowIfFailing);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, status]);
}
