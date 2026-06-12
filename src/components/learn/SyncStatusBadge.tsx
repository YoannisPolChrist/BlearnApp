import { useEffect, useState } from 'react';
import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import { cn } from '@/lib/utils';

/**
 * Honest, compact sync status (Masterplan 3.6): a sync that fails silently is
 * indistinguishable from "sync is broken" for the user. This badge surfaces
 * the learning sync runtime state with at most one short line and an inline
 * retry for errors. Copy budget: every string ≤ 1 line.
 */

const REFRESH_INTERVAL_MS = 30_000;

function formatRelativeTime(timestamp: number, now: number): string {
  const deltaSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (deltaSeconds < 60) return 'gerade eben';
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) return `vor ${deltaMinutes} Min`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `vor ${deltaHours} Std`;
  const deltaDays = Math.round(deltaHours / 24);
  return `vor ${deltaDays} Tg`;
}

export interface SyncStatusBadgeProps {
  busy?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function SyncStatusBadge({ busy = false, onRetry, className }: SyncStatusBadgeProps) {
  const learning = useCloudSyncRuntimeStore((state) => state.learning);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  if (busy || learning.status === 'starting') {
    return (
      <span
        data-testid="sync-status-badge"
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <Loader2 size={13} className="animate-spin" aria-hidden />
        Synchronisiert …
      </span>
    );
  }

  if (learning.status === 'error') {
    return (
      <span
        data-testid="sync-status-badge"
        className={cn('inline-flex items-center gap-1.5 text-xs text-destructive', className)}
      >
        <AlertTriangle size={13} aria-hidden />
        Sync fehlgeschlagen
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline underline-offset-2"
          >
            Erneut versuchen
          </button>
        ) : null}
      </span>
    );
  }

  if (learning.status === 'blocked-signed-out') {
    return (
      <span
        data-testid="sync-status-badge"
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <CloudOff size={13} aria-hidden />
        Nicht angemeldet
      </span>
    );
  }

  if (learning.status === 'blocked-firebase-missing' || learning.status === 'blocked-writes-disabled') {
    return (
      <span
        data-testid="sync-status-badge"
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <CloudOff size={13} aria-hidden />
        Sync nicht verfügbar
      </span>
    );
  }

  if (learning.status === 'ready' && learning.lastSuccessfulSyncAt) {
    return (
      <span
        data-testid="sync-status-badge"
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <Check size={13} className="text-success" aria-hidden />
        Synchronisiert {formatRelativeTime(learning.lastSuccessfulSyncAt, now)}
      </span>
    );
  }

  // idle / ready without timestamp: stay quiet rather than explain.
  return null;
}
