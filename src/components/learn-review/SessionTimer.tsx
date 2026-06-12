import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SessionTimerProps {
  startedAt: number;
  className?: string;
  visible?: boolean;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  if (minutes < 60) {
    return `${minutes}:${seconds}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = String(minutes % 60).padStart(2, '0');
  return `${hours}:${remainingMinutes}:${seconds}`;
}

export function SessionTimer({ startedAt, className, visible = true }: SessionTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - startedAt));

  useEffect(() => {
    setElapsedMs(Math.max(0, Date.now() - startedAt));

    const intervalId = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startedAt]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[hsl(var(--mode-learn-border)/0.26)] bg-[hsl(var(--mode-learn-surface)/0.36)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[hsl(var(--mode-learn-foreground)/0.84)] shadow-[0_12px_28px_hsl(var(--mode-learn-glow)/0.1)]',
        className,
      )}
    >
      <span>Laufzeit</span>
      <span className="text-[11px] tracking-[0.04em] text-foreground">{formatElapsed(elapsedMs)}</span>
    </div>
  );
}
