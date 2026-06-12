import { Shield, Waves, Brain, Flame } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandMark';
import { getModePalette } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';

type BlockingLoadingMode = 'reflection' | 'learn' | 'penalty' | 'lock';
type BlockingLoadingTone = 'reflection' | 'learn' | 'penalty' | 'strict';

interface BlockingLoadingShellProps {
  mode?: string | null;
  title?: string;
  body?: string;
}

function resolveBlockingLoadingMode(mode: string | null | undefined): BlockingLoadingMode {
  if (mode === 'learn') {
    return 'learn';
  }

  if (mode === 'penalty') {
    return 'penalty';
  }

  if (mode === 'strict') {
    return 'reflection';
  }

  if (mode === 'lock') {
    return 'lock';
  }

  return 'reflection';
}

function resolveBlockingLoadingTone(mode: BlockingLoadingMode): BlockingLoadingTone {
  return mode === 'lock' ? 'strict' : mode;
}

function getModeCopy(mode: BlockingLoadingMode) {
  switch (mode) {
    case 'learn':
      return {
        icon: Brain,
        title: 'Blearn bereitet Learn vor',
        body: 'Deine Freischaltung wird geladen.',
      };
    case 'penalty':
      return {
        icon: Flame,
        title: 'Blearn bereitet den Schutz vor',
        body: 'Der nächste Schritt ist gleich bereit.',
      };
    case 'lock':
      return {
        icon: Shield,
        title: 'Blearn schützt gerade deinen Fokus',
        body: 'Die Sperre wird stabil aufgebaut.',
      };
    default:
      return {
        icon: Waves,
        title: 'Blearn bereitet deine Reflexion vor',
        body: 'Der nächste Schritt ist gleich bereit.',
      };
  }
}

export function BlockingLoadingShell({
  mode,
  title,
  body,
}: BlockingLoadingShellProps) {
  const resolvedMode = resolveBlockingLoadingMode(mode);
  const palette = getModePalette(resolveBlockingLoadingTone(resolvedMode));
  const copy = getModeCopy(resolvedMode);
  const Icon = copy.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="blocking-loading-shell"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-8"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.98)_38%,hsl(var(--background)))]" />
      <div className={cn('absolute left-1/2 top-[20%] h-64 w-64 -translate-x-1/2 rounded-full blur-3xl', palette.glow)} />
      <div className={cn('absolute bottom-[12%] right-[-4rem] h-56 w-56 rounded-full blur-3xl opacity-80', palette.glow)} />

      <div className={cn('relative z-10 w-full max-w-md rounded-[2rem] border px-6 py-7 shadow-[0_24px_60px_hsl(var(--foreground)/0.08)]', palette.card)}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <BrandLockup
              compact
              subtitle="Blocking Flow"
              className="items-center"
              titleClassName="text-[1.6rem]"
              subtitleClassName="text-[10px]"
            />
          </div>
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', palette.icon)}>
            <Icon size={20} />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="text-2xl font-black tracking-[-0.05em] text-foreground">
            {title || copy.title}
          </h2>
          <p className="text-sm leading-relaxed text-foreground/72">
            {body || copy.body}
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          <div className="h-2.5 w-4/5 rounded-full bg-foreground/10" />
          <div className="h-2.5 w-full rounded-full bg-foreground/8" />
          <div className="h-2.5 w-3/5 rounded-full bg-foreground/6" />
        </div>
      </div>
    </div>
  );
}

