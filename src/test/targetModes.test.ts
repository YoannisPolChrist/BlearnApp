import { describe, expect, it } from 'vitest';
import {
  createDefaultStrictAddonMap,
  deriveActiveModes,
  getTargetMode,
  isLegacyTargetModeId,
  normalizeTargetModeId,
  setTargetModeRecord,
} from '@/lib/targetModes';

describe('target mode helpers', () => {
  it('assigns, reassigns and removes a target mode', () => {
    const assigned = setTargetModeRecord({}, 'app', 'com.instagram.android', 'strict');
    expect(getTargetMode({ blockedAppModes: assigned, blockedWebsiteModes: {}, blockedSearchTermModes: {} }, 'app', 'com.instagram.android')).toBe('strict');

    const reassigned = setTargetModeRecord(assigned, 'app', 'com.instagram.android', 'learn');
    expect(getTargetMode({ blockedAppModes: reassigned, blockedWebsiteModes: {}, blockedSearchTermModes: {} }, 'app', 'com.instagram.android')).toBe('learn');

    const removed = setTargetModeRecord(reassigned, 'app', 'com.instagram.android', null);
    expect(getTargetMode({ blockedAppModes: removed, blockedWebsiteModes: {}, blockedSearchTermModes: {} }, 'app', 'com.instagram.android')).toBeNull();
  });

  it('derives active modes across targets and prioritizes lock', () => {
    const activeModes = deriveActiveModes({
      blockedAppModes: { 'com.instagram.android': 'strict' },
      blockedWebsiteModes: { 'youtube.com': 'learn' },
      blockedSearchTermModes: { doomscrolling: 'penalty' },
      strictLockUntil: Date.now() + 60_000,
    });

    expect(activeModes).toEqual(['lock', 'penalty', 'learn', 'strict']);
  });

  it('keeps legacy strict data compatible while accepting reflection aliases', () => {
    expect(normalizeTargetModeId('reflection')).toBe('strict');
    expect(isLegacyTargetModeId('strict')).toBe(true);

    const assigned = setTargetModeRecord({}, 'app', 'com.instagram.android', 'reflection');
    expect(assigned['com.instagram.android']).toBe('strict');
    expect(getTargetMode({ blockedAppModes: assigned, blockedWebsiteModes: {}, blockedSearchTermModes: {} }, 'app', 'com.instagram.android')).toBe('strict');
  });

  it('adds strict when a strict add-on is active', () => {
    const strictAddons = createDefaultStrictAddonMap();
    strictAddons.learn = {
      ...strictAddons.learn,
      enabled: true,
      lockUntil: Date.now() + 60_000,
      lockedAppIds: ['com.instagram.android'],
    };

    const activeModes = deriveActiveModes({
      blockedAppModes: { 'com.instagram.android': 'learn' },
      blockedWebsiteModes: {},
      blockedSearchTermModes: {},
      strictAddons,
    });

    expect(activeModes).toEqual(['learn', 'strict']);
  });
});
