import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteBlockingSync } from '@/hooks/useRemoteBlockingSync';
import { useAppStore } from '@/store/useAppStore';
import { resetAuthStoreForTests, useAuthStore } from '@/store/useAuthStore';


vi.mock('@/lib/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/firebase')>();
  return {
    ...actual,
    isFirebaseConfigured: () => true,
    isFirebaseWriteEnabled: () => true,
  };
});

vi.mock('@/services/firebaseProgressSyncService', () => ({
  subscribeToRemoteBlockingInstruction: vi.fn(() => () => undefined),
}));

function RemoteBlockingProbe() {
  useRemoteBlockingSync();
  return null;
}

describe('useRemoteBlockingSync', () => {
  beforeEach(() => {
    resetAuthStoreForTests();
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it('keeps a persisted unexpired block while authentication is still starting', async () => {
    const instruction = {
      id: 'persisted-startup-lock',
      createdAt: Date.now() - 60_000,
      expiresAt: Date.now() + 60_000,
      blockedCategories: ['games'],
      mode: 'strict' as const,
    };
    useAppStore.setState({
      remoteBlockingEnabled: true,
      remoteBlockingInstruction: instruction,
      resolvedRemoteBlockedApps: ['com.example.game'],
    });
    useAuthStore.setState({
      status: 'checking',
      authReady: false,
      user: null,
    });

    render(<RemoteBlockingProbe />);

    await waitFor(() => {
      expect(useAppStore.getState().remoteBlockingInstruction).toEqual(instruction);
      expect(useAppStore.getState().resolvedRemoteBlockedApps).toEqual(['com.example.game']);
    });
  });
});
