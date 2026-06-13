import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Signature-Ring (Masterplan D.1): der Atem-/Fokus-Kreis wird zur visuellen
 * Identität der ganzen App. Ein reduziertes Ring-Motiv ersetzt verschiedene
 * Fortschrittsdarstellungen — Lernsession, Unlock-Countdown, Dashboard.
 *
 * Rein token-/`currentColor`-basiert (D.4): die Farbe kommt vom Eltern-Text,
 * keine Hardcoded-Hex/HSL. Respektiert `prefers-reduced-motion` über die
 * `transition`-Utility, die bei reduzierter Bewegung global entschärft wird.
 */

export interface SignatureRingProps {
  /** Fortschritt 0..1. */
  progress: number;
  /** Außendurchmesser in px. */
  size?: number;
  /** Ringdicke in px. */
  strokeWidth?: number;
  /** Inhalt in der Mitte (Zahl, Icon …). */
  children?: ReactNode;
  className?: string;
  /** Track-Deckkraft 0..1 (Hintergrundring). */
  trackOpacity?: number;
  'aria-label'?: string;
}

function SignatureRingInner({
  progress,
  size = 72,
  strokeWidth = 6,
  children,
  className,
  trackOpacity = 0.18,
  'aria-label': ariaLabel,
}: SignatureRingProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role={ariaLabel ? 'progressbar' : undefined}
      aria-label={ariaLabel}
      aria-valuenow={ariaLabel ? Math.round(clamped * 100) : undefined}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          style={{ opacity: trackOpacity }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}

export const SignatureRing = memo(SignatureRingInner);
