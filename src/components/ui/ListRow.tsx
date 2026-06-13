import type { ComponentType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Listenzeile (Masterplan D.1): kompaktes Layoutprimitiv für alles
 * Konfigurative — eine Zeile = Icon + Label + Wert/Control, ~56px hoch,
 * Trennlinie statt Card-Rahmen. Ersetzt Card-Stapel in Modes/Settings.
 *
 * Token-/`currentColor`-basiert (D.4), Touch-Target ≥ 44px, ein optionaler
 * Trailing-Slot (Wert, Toggle, Chevron). Als <button> wenn `onClick`, sonst <div>.
 */

export interface ListRowProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Höchstens eine Zeile Sekundärtext — nur wenn das Label allein missverständlich ist (D.2). */
  hint?: string;
  /** Rechtsbündiger Inhalt: Wert-Text, Toggle, Badge … */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Zeigt ein Chevron rechts (für navigierende Zeilen). */
  showChevron?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function ListRow({
  icon: Icon,
  label,
  hint,
  trailing,
  onClick,
  showChevron = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ListRowProps) {
  const content = (
    <>
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] bg-muted/60 text-foreground/72">
          <Icon size={17} />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.95rem] font-bold tracking-[-0.01em] text-foreground">{label}</span>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{trailing}</span> : null}
      {showChevron ? <ChevronRight size={16} className="shrink-0 text-muted-foreground/70" /> : null}
    </>
  );

  const baseClassName = cn(
    'flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left',
    onClick && !disabled && 'transition-colors hover:bg-muted/40 active:bg-muted/60',
    disabled && 'opacity-50',
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={baseClassName} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return (
    <div className={baseClassName} aria-label={ariaLabel}>
      {content}
    </div>
  );
}

/**
 * Container für ListRows: ein Block mit Trennlinien zwischen den Zeilen statt
 * einzelner Card-Rahmen (D.1). Optionaler Sektionstitel als Eyebrow.
 */
export function ListRowGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title ? (
        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/60 divide-y divide-border/60">
        {children}
      </div>
    </section>
  );
}
