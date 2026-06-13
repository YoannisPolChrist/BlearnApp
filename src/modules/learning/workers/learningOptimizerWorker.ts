import type { LearningPreset, ReviewLog } from '../domain/entities';
import {
  optimizeFsrsWeights,
  type WeightOptimizationOptions,
  type WeightOptimizationResult,
} from '../stats/weightOptimizer';

/**
 * Führt die FSRS-Gewichtsoptimierung (4.3) in einem echten Web Worker aus,
 * damit der Main-Thread (und damit das Blocking-Overlay) nie blockiert.
 * Fallback auf synchrone Ausführung, wenn Worker nicht verfügbar sind
 * (Tests, ältere WebViews).
 */
export async function runWeightOptimizationInWorker(
  reviewLogs: ReviewLog[],
  preset: LearningPreset,
  options?: WeightOptimizationOptions,
): Promise<WeightOptimizationResult> {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise<WeightOptimizationResult>((resolve, reject) => {
        const worker = new Worker(new URL('./weightOptimizer.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: WeightOptimizationResult; error?: string }>) => {
          worker.terminate();
          if (event.data.ok && event.data.result) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error || 'weight optimization failed'));
          }
        };
        worker.onerror = (event) => {
          worker.terminate();
          reject(event.error instanceof Error ? event.error : new Error(event.message || 'worker error'));
        };
        worker.postMessage({ reviewLogs, preset, options });
      });
    } catch {
      // Worker-Start fehlgeschlagen (z. B. CSP/Test-Umgebung) → synchroner Fallback.
    }
  }

  return optimizeFsrsWeights(reviewLogs, preset, options);
}
