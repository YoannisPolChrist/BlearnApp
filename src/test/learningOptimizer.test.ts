import { describe, expect, it } from 'vitest';
import {
  canAttemptLearningPresetOptimization,
  getDefaultLearningPreset,
} from '@/lib/learning';

describe('learning optimizer quick gate', () => {
  it('skips optimization attempts before the minimum review threshold is reached', () => {
    const preset = getDefaultLearningPreset();

    expect(canAttemptLearningPresetOptimization(preset, 299, 1_700_000_000_000)).toBe(false);
    expect(canAttemptLearningPresetOptimization(preset, 300, 1_700_000_000_000)).toBe(true);
  });

  it('waits for both enough new reviews and the next scheduled optimizer window', () => {
    const now = 1_700_000_000_000;
    const preset = {
      ...getDefaultLearningPreset(),
      lastOptimizerRunAt: now - 10 * 24 * 60 * 60 * 1000,
      lastOptimizerReviewCount: 600,
    };

    expect(canAttemptLearningPresetOptimization(preset, 1_099, now)).toBe(false);
    expect(canAttemptLearningPresetOptimization(preset, 1_100, now)).toBe(false);
    expect(
      canAttemptLearningPresetOptimization(
        preset,
        1_100,
        now + 25 * 24 * 60 * 60 * 1000,
      ),
    ).toBe(true);
  });
});
