import { useEffect, useRef } from 'react';

/**
 * setInterval, das nur laeuft, solange das Dokument sichtbar ist.
 *
 * Fuer Anzeige-Timer, die ihren Wert aus absoluten Zeitstempeln ableiten
 * (Date.now() - startedAt, verbleibende Sperrzeit): Im Hintergrund tickt
 * nichts weiter (spart Akku im Android-WebView), beim Sichtbarwerden wird
 * der Callback sofort einmal ausgefuehrt, sodass die Anzeige ohne Drift
 * aufholt.
 */
export function useVisibilityGatedInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let intervalId: number | null = null;

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(() => callbackRef.current(), intervalMs);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        callbackRef.current();
        start();
      }
    };

    if (document.visibilityState !== 'hidden') {
      start();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
