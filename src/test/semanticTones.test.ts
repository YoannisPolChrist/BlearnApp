import { describe, expect, it } from 'vitest';
import { getModeTone } from '@/lib/semanticTones';

describe('semantic tones', () => {
  it('keeps legacy strict mode aligned with reflection while lock uses the violet strict palette', () => {
    expect(getModeTone('strict')).toBe('reflection');
    expect(getModeTone('lock')).toBe('strict');
  });
});
