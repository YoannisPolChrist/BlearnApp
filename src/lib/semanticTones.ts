import type { ActiveModeId, TargetModeId } from '@/lib/targetModes';

export type SemanticTone =
  | 'default'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'normal'
  | 'strict'
  | 'reflection'
  | 'learn'
  | 'penalty'
  | 'breathing';

export type ModeColorId = 'normal' | 'strict' | 'reflection' | 'learn' | 'penalty' | 'lock' | 'breathing';

export interface TonePalette {
  card: string;
  hero: string;
  badge: string;
  icon: string;
  line: string;
  glow: string;
  button: string;
  indicator: string;
  ring: string;
  text: string;
}

export const tonePalettes: Record<Exclude<SemanticTone, 'default'>, TonePalette> = {
  primary: {
    card: 'border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.09)]',
    hero: 'premium-hero premium-hero-brand',
    badge: 'border border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.14)] text-primary',
    icon: 'border border-[hsl(var(--primary)/0.16)] bg-[hsl(var(--primary)/0.16)] text-primary shadow-[0_16px_32px_hsl(var(--primary)/0.12)]',
    line: 'from-primary via-[hsl(var(--primary)/0.86)] to-[hsl(var(--primary)/0.22)]',
    glow: 'bg-[hsl(var(--primary)/0.22)]',
    button: 'bg-primary text-primary-foreground shadow-[0_20px_44px_hsl(var(--primary)/0.26)]',
    indicator: 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]',
    ring: 'ring-1 ring-[hsl(var(--primary)/0.24)]',
    text: 'text-primary',
  },
  accent: {
    card: 'border-[hsl(var(--accent)/0.24)] bg-[hsl(var(--accent)/0.1)]',
    hero: 'premium-hero premium-hero-learn',
    badge: 'border border-[hsl(var(--accent)/0.22)] bg-[hsl(var(--accent)/0.16)] text-[hsl(var(--accent-foreground))]',
    icon: 'border border-[hsl(var(--accent)/0.18)] bg-[hsl(var(--accent)/0.18)] text-[hsl(var(--accent-foreground))] shadow-[0_16px_32px_hsl(var(--accent)/0.12)]',
    line: 'from-[hsl(var(--accent))] via-[hsl(var(--accent)/0.88)] to-[hsl(var(--accent)/0.22)]',
    glow: 'bg-[hsl(var(--accent)/0.22)]',
    button: 'bg-accent text-accent-foreground shadow-[0_20px_44px_hsl(var(--accent)/0.26)]',
    indicator: 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))]',
    ring: 'ring-1 ring-[hsl(var(--accent)/0.24)]',
    text: 'text-[hsl(var(--accent-foreground))]',
  },
  success: {
    card: 'border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.09)]',
    hero: 'premium-hero premium-hero-brand',
    badge: 'border border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.14)] text-success',
    icon: 'border border-[hsl(var(--success)/0.16)] bg-[hsl(var(--success)/0.16)] text-success shadow-[0_16px_32px_hsl(var(--success)/0.12)]',
    line: 'from-success via-[hsl(var(--success)/0.86)] to-[hsl(var(--success)/0.22)]',
    glow: 'bg-[hsl(var(--success)/0.22)]',
    button: 'bg-success text-success-foreground shadow-[0_20px_44px_hsl(var(--success)/0.26)]',
    indicator: 'border-[hsl(var(--success))] bg-[hsl(var(--success))]',
    ring: 'ring-1 ring-[hsl(var(--success)/0.24)]',
    text: 'text-success',
  },
  warning: {
    card: 'border-[hsl(var(--warning)/0.24)] bg-[hsl(var(--warning)/0.1)]',
    hero: 'premium-hero premium-hero-learn',
    badge: 'border border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.16)] text-[hsl(var(--warning-foreground))]',
    icon: 'border border-[hsl(var(--warning)/0.16)] bg-[hsl(var(--warning)/0.16)] text-[hsl(var(--warning-foreground))] shadow-[0_16px_32px_hsl(var(--warning)/0.12)]',
    line: 'from-[hsl(var(--warning))] via-[hsl(var(--warning)/0.86)] to-[hsl(var(--warning)/0.22)]',
    glow: 'bg-[hsl(var(--warning)/0.22)]',
    button: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-[0_20px_44px_hsl(var(--warning)/0.26)]',
    indicator: 'border-[hsl(var(--warning))] bg-[hsl(var(--warning))]',
    ring: 'ring-1 ring-[hsl(var(--warning)/0.24)]',
    text: 'text-[hsl(var(--warning-foreground))]',
  },
  destructive: {
    card: 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive)/0.09)]',
    hero: 'premium-hero premium-hero-penalty',
    badge: 'border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive)/0.14)] text-destructive',
    icon: 'border border-[hsl(var(--destructive)/0.16)] bg-[hsl(var(--destructive)/0.16)] text-destructive shadow-[0_16px_32px_hsl(var(--destructive)/0.12)]',
    line: 'from-destructive via-[hsl(var(--destructive)/0.86)] to-[hsl(var(--destructive)/0.22)]',
    glow: 'bg-[hsl(var(--destructive)/0.22)]',
    button: 'bg-destructive text-destructive-foreground shadow-[0_20px_44px_hsl(var(--destructive)/0.26)]',
    indicator: 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]',
    ring: 'ring-1 ring-[hsl(var(--destructive)/0.24)]',
    text: 'text-destructive',
  },
  normal: {
    card: 'border-[hsl(var(--mode-normal-border)/0.42)] bg-[hsl(var(--mode-normal-surface)/0.72)]',
    hero: 'premium-hero premium-hero-normal',
    badge: 'border border-[hsl(var(--mode-normal-border)/0.44)] bg-[hsl(var(--mode-normal-surface)/0.9)] text-[hsl(var(--mode-normal-foreground))]',
    icon: 'border border-[hsl(var(--mode-normal-border)/0.36)] bg-[hsl(var(--mode-normal-surface)/0.92)] text-[hsl(var(--mode-normal-foreground))] shadow-[0_16px_32px_hsl(var(--mode-normal-glow)/0.12)]',
    line: 'from-[hsl(var(--mode-normal))] via-[hsl(var(--mode-normal)/0.84)] to-[hsl(var(--mode-normal-glow)/0.22)]',
    glow: 'bg-[hsl(var(--mode-normal-glow)/0.24)]',
    button: 'bg-[hsl(var(--mode-normal))] text-white shadow-[0_20px_44px_hsl(var(--mode-normal-glow)/0.26)]',
    indicator: 'border-[hsl(var(--mode-normal-border))] bg-[hsl(var(--mode-normal))]',
    ring: 'ring-1 ring-[hsl(var(--mode-normal-border)/0.4)]',
    text: 'text-[hsl(var(--mode-normal-foreground))]',
  },
  strict: {
    card: 'border-[hsl(var(--mode-strict-border)/0.44)] bg-[hsl(var(--mode-strict-surface)/0.78)]',
    hero: 'premium-hero premium-hero-strict',
    badge: 'border border-[hsl(var(--mode-strict-border)/0.44)] bg-[hsl(var(--mode-strict-surface)/0.92)] text-[hsl(var(--mode-strict-foreground))]',
    icon: 'border border-[hsl(var(--mode-strict-border)/0.36)] bg-[hsl(var(--mode-strict-surface)/0.92)] text-[hsl(var(--mode-strict-foreground))] shadow-[0_16px_32px_hsl(var(--mode-strict-glow)/0.14)]',
    line: 'from-[hsl(var(--mode-strict))] via-[hsl(var(--mode-strict)/0.86)] to-[hsl(var(--mode-strict-glow)/0.22)]',
    glow: 'bg-[hsl(var(--mode-strict-glow)/0.24)]',
    button: 'bg-[hsl(var(--mode-strict))] text-white shadow-[0_20px_44px_hsl(var(--mode-strict-glow)/0.28)]',
    indicator: 'border-[hsl(var(--mode-strict-border))] bg-[hsl(var(--mode-strict))]',
    ring: 'ring-1 ring-[hsl(var(--mode-strict-border)/0.44)]',
    text: 'text-[hsl(var(--mode-strict-foreground))]',
  },
  reflection: {
    card: 'border-[hsl(var(--mode-reflection-border)/0.44)] bg-[hsl(var(--mode-reflection-surface)/0.78)]',
    hero: 'premium-hero premium-hero-reflection',
    badge: 'border border-[hsl(var(--mode-reflection-border)/0.44)] bg-[hsl(var(--mode-reflection-surface)/0.94)] text-[hsl(var(--mode-reflection-foreground))]',
    icon: 'border border-[hsl(var(--mode-reflection-border)/0.38)] bg-[hsl(var(--mode-reflection-surface)/0.94)] text-[hsl(var(--mode-reflection-foreground))] shadow-[0_16px_32px_hsl(var(--mode-reflection-glow)/0.14)]',
    line: 'from-[hsl(var(--mode-reflection))] via-[hsl(var(--mode-reflection)/0.86)] to-[hsl(var(--mode-reflection-glow)/0.22)]',
    glow: 'bg-[hsl(var(--mode-reflection-glow)/0.24)]',
    button: 'bg-[hsl(var(--mode-reflection))] text-white shadow-[0_20px_44px_hsl(var(--mode-reflection-glow)/0.28)]',
    indicator: 'border-[hsl(var(--mode-reflection-border))] bg-[hsl(var(--mode-reflection))]',
    ring: 'ring-1 ring-[hsl(var(--mode-reflection-border)/0.44)]',
    text: 'text-[hsl(var(--mode-reflection-foreground))]',
  },
  learn: {
    card: 'border-[hsl(var(--mode-learn-border)/0.46)] bg-[hsl(var(--mode-learn-surface)/0.82)]',
    hero: 'premium-hero premium-hero-learn',
    badge: 'border border-[hsl(var(--mode-learn-border)/0.46)] bg-[hsl(var(--mode-learn-surface)/0.96)] text-[hsl(var(--mode-learn-foreground))]',
    icon: 'border border-[hsl(var(--mode-learn-border)/0.38)] bg-[hsl(var(--mode-learn-surface)/0.96)] text-[hsl(var(--mode-learn-foreground))] shadow-[0_16px_32px_hsl(var(--mode-learn-glow)/0.14)]',
    line: 'from-[hsl(var(--mode-learn))] via-[hsl(var(--mode-learn)/0.86)] to-[hsl(var(--mode-learn-glow)/0.24)]',
    glow: 'bg-[hsl(var(--mode-learn-glow)/0.26)]',
    button: 'bg-[hsl(var(--mode-learn))] text-[hsl(var(--mode-learn-foreground))] shadow-[0_20px_44px_hsl(var(--mode-learn-glow)/0.28)]',
    indicator: 'border-[hsl(var(--mode-learn-border))] bg-[hsl(var(--mode-learn))]',
    ring: 'ring-1 ring-[hsl(var(--mode-learn-border)/0.44)]',
    text: 'text-[hsl(var(--mode-learn-foreground))]',
  },
  penalty: {
    card: 'border-[hsl(var(--mode-penalty-border)/0.46)] bg-[hsl(var(--mode-penalty-surface)/0.82)]',
    hero: 'premium-hero premium-hero-penalty',
    badge: 'border border-[hsl(var(--mode-penalty-border)/0.46)] bg-[hsl(var(--mode-penalty-surface)/0.94)] text-[hsl(var(--mode-penalty-foreground))]',
    icon: 'border border-[hsl(var(--mode-penalty-border)/0.38)] bg-[hsl(var(--mode-penalty-surface)/0.94)] text-[hsl(var(--mode-penalty-foreground))] shadow-[0_16px_32px_hsl(var(--mode-penalty-glow)/0.14)]',
    line: 'from-[hsl(var(--mode-penalty))] via-[hsl(var(--mode-penalty)/0.86)] to-[hsl(var(--mode-penalty-glow)/0.24)]',
    glow: 'bg-[hsl(var(--mode-penalty-glow)/0.26)]',
    button: 'bg-[hsl(var(--mode-penalty))] text-destructive-foreground shadow-[0_20px_44px_hsl(var(--mode-penalty-glow)/0.28)]',
    indicator: 'border-[hsl(var(--mode-penalty-border))] bg-[hsl(var(--mode-penalty))]',
    ring: 'ring-1 ring-[hsl(var(--mode-penalty-border)/0.44)]',
    text: 'text-[hsl(var(--mode-penalty-foreground))]',
  },
  breathing: {
    card: 'border-[hsl(var(--mode-breathing-border)/0.44)] bg-[hsl(var(--mode-breathing-surface)/0.78)]',
    hero: 'premium-hero premium-hero-breathing',
    badge: 'border border-[hsl(var(--mode-breathing-border)/0.44)] bg-[hsl(var(--mode-breathing-surface)/0.94)] text-[hsl(var(--mode-breathing-foreground))]',
    icon: 'border border-[hsl(var(--mode-breathing-border)/0.38)] bg-[hsl(var(--mode-breathing-surface)/0.94)] text-[hsl(var(--mode-breathing-foreground))] shadow-[0_16px_32px_hsl(var(--mode-breathing-glow)/0.14)]',
    line: 'from-[hsl(var(--mode-breathing))] via-[hsl(var(--mode-breathing)/0.86)] to-[hsl(var(--mode-breathing-glow)/0.22)]',
    glow: 'bg-[hsl(var(--mode-breathing-glow)/0.26)]',
    button: 'bg-[hsl(var(--mode-breathing))] text-white shadow-[0_20px_44px_hsl(var(--mode-breathing-glow)/0.28)]',
    indicator: 'border-[hsl(var(--mode-breathing-border))] bg-[hsl(var(--mode-breathing))]',
    ring: 'ring-1 ring-[hsl(var(--mode-breathing-border)/0.44)]',
    text: 'text-[hsl(var(--mode-breathing-foreground))]',
  },
};

export function normalizeSemanticTone(tone: SemanticTone | null | undefined): Exclude<SemanticTone, 'default'> | null {
  if (!tone) {
    return null;
  }

  if (tone === 'strict') {
    return 'reflection';
  }

  return tone;
}

export function isLegacySemanticTone(tone: SemanticTone | null | undefined): boolean {
  return tone === 'strict';
}

export function getModeTone(mode: ModeColorId | ActiveModeId | TargetModeId): Exclude<SemanticTone, 'default'> {
  const normalizedMode = mode;

  switch (normalizedMode) {
    case 'normal':
      return 'normal';
    case 'strict':
      return 'reflection';
    case 'learn':
      return 'learn';
    case 'penalty':
      return 'penalty';
    case 'lock':
      return 'strict';
    case 'reflection':
      return 'reflection';
    case 'breathing':
      return 'breathing';
    default:
      return 'primary';
  }
}

export function getModePalette(mode: ModeColorId | ActiveModeId | TargetModeId): TonePalette {
  return tonePalettes[getModeTone(mode)];
}

export function getModeSelectionClasses(mode: Exclude<ModeColorId, 'breathing'>) {
  const palette = getModePalette(mode);

  return {
    selected: `${palette.card} shadow-[0_20px_50px_hsl(var(--foreground)/0.08)]`,
    ring: palette.ring,
    dot: palette.indicator,
    badge: palette.badge,
    icon: palette.icon,
  };
}
