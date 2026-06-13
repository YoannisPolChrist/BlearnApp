/**
 * Leichte Haptik (Masterplan 4b.4) — „billig, großer Gefühlseffekt". Nutzt die
 * Web-Vibration-API (keine neue Capacitor-Abhängigkeit, D.4). Respektiert
 * `prefers-reduced-motion` und scheitert still, wo nicht unterstützt.
 */

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function vibrate(pattern: number | number[]): void {
  if (reducedMotion()) {
    return;
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration ist Komfort, nie kritisch.
  }
}

/** Kurzes Tick bei einer Review-Antwort. */
export function hapticTick(): void {
  vibrate(12);
}

/** Belohnungs-Muster bei erfolgreicher Freischaltung. */
export function hapticSuccess(): void {
  vibrate([0, 20, 40, 30]);
}
