import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SyncStatusBadge } from '@/components/learn/SyncStatusBadge';
import {
  resetCloudSyncRuntimeForTests,
  useCloudSyncRuntimeStore,
} from '@/lib/cloudSyncRuntime';

describe('SyncStatusBadge', () => {
  beforeEach(() => {
    resetCloudSyncRuntimeForTests();
  });

  it('renders nothing while idle so quiet states stay quiet', () => {
    render(<SyncStatusBadge />);
    expect(screen.queryByTestId('sync-status-badge')).toBeNull();
  });

  it('shows the last successful sync as relative time when ready', () => {
    useCloudSyncRuntimeStore.getState().setLearning({
      status: 'ready',
      lastSuccessfulSyncAt: Date.now() - 5 * 60 * 1000,
    });

    render(<SyncStatusBadge />);
    expect(screen.getByTestId('sync-status-badge').textContent).toContain('Synchronisiert vor 5 Min');
  });

  it('shows a busy state while a sync is running', () => {
    render(<SyncStatusBadge busy />);
    expect(screen.getByTestId('sync-status-badge').textContent).toContain('Synchronisiert …');
  });

  it('surfaces errors with a working retry action', () => {
    useCloudSyncRuntimeStore.getState().setLearning({
      status: 'error',
      currentError: 'boom',
    });
    const onRetry = vi.fn();

    render(<SyncStatusBadge onRetry={onRetry} />);

    expect(screen.getByTestId('sync-status-badge').textContent).toContain('Sync fehlgeschlagen');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('names the signed-out state without explaining it', () => {
    useCloudSyncRuntimeStore.getState().setLearning({ status: 'blocked-signed-out' });
    render(<SyncStatusBadge />);
    expect(screen.getByTestId('sync-status-badge').textContent).toContain('Nicht angemeldet');
  });

  it('collapses both blocked configurations into one unavailable state', () => {
    useCloudSyncRuntimeStore.getState().setLearning({ status: 'blocked-writes-disabled' });
    render(<SyncStatusBadge />);
    expect(screen.getByTestId('sync-status-badge').textContent).toContain('Sync nicht verfügbar');
  });
});
