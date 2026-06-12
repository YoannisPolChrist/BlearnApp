import { describe, expect, it } from 'vitest';
import { formatApproxEuro, formatSats, formatSatsWithApproxEuro } from '@/lib/view-models/wallet';

describe('wallet view models', () => {
  it('formats sats and a readable euro approximation', () => {
    expect(formatSats(1200)).toBe('1.200 sats');
    expect(formatApproxEuro(1200)).toMatch(/^1,20\s*€$/);
    expect(formatSatsWithApproxEuro(1200)).toMatch(/^1\.200 sats .*ca\.\s*1,20\s*€$/);
  });

  it('normalizes invalid values to zero', () => {
    expect(formatSats(null)).toBe('0 sats');
    expect(formatApproxEuro(-3)).toMatch(/^0,00\s*€$/);
    expect(formatSatsWithApproxEuro(undefined)).toMatch(/^0 sats .*ca\.\s*0,00\s*€$/);
  });
});
