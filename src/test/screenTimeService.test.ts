import { describe, expect, it } from 'vitest';
import { getAppLabel } from '@/services/screenTimeService';

describe('screenTimeService labels', () => {
  it('humanizes raw package identifiers before they reach the UI', () => {
    expect(getAppLabel({ packageName: 'com.mi.android.globallauncher' })).toBe('Launcher');
    expect(getAppLabel({ packageName: 'com.whatsapp' })).toBe('WhatsApp');
    expect(getAppLabel({ packageName: 'com.google.android.youtube' })).toBe('YouTube');
  });
});
