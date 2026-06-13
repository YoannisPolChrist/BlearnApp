import { optimizeFsrsWeights } from '../stats/weightOptimizer';
import type { LearningPreset, ReviewLog } from '../domain/entities';
import type { WeightOptimizationOptions } from '../stats/weightOptimizer';

interface WeightOptimizerWorkerRequest {
  reviewLogs: ReviewLog[];
  preset: LearningPreset;
  options?: WeightOptimizationOptions;
}

self.onmessage = (event: MessageEvent<WeightOptimizerWorkerRequest>) => {
  const { reviewLogs, preset, options } = event.data;
  try {
    const result = optimizeFsrsWeights(reviewLogs, preset, options);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
