import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from 'framer-motion';
import {
  interactiveHeroLift,
  interactiveLift,
  interactiveTap,
  resolveAmbientMotion,
  type AmbientMotionTone,
} from '@/lib/motion';
import { tonePalettes, type SemanticTone } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
  tilt?: boolean;
  tone?: SemanticTone;
  elevation?: 'flat' | 'raised' | 'hero';
  surface?: 'standard' | 'featured' | 'hero';
  highlight?: boolean;
  accentGlow?: boolean;
  motionPreset?: 'soft' | 'dense' | 'hero';
  ambient?: AmbientMotionTone;
}

type SharedGlassCardSurfaceProps = Omit<GlassCardProps, 'ref'> & {
  forwardedRef: ForwardedRef<HTMLDivElement>;
  reducedMotion: boolean | null;
};

function setCardRef(node: HTMLDivElement | null, forwardedRef: ForwardedRef<HTMLDivElement>) {
  if (typeof forwardedRef === 'function') {
    forwardedRef(node);
    return;
  }

  if (forwardedRef) {
    forwardedRef.current = node;
  }
}

function resolveGlassCardPresentation(options: {
  className?: string;
  interactive?: boolean;
  tone: SemanticTone;
  elevation: NonNullable<GlassCardProps['elevation']>;
  surface?: GlassCardProps['surface'];
  highlight: boolean;
  accentGlow: boolean;
  motionPreset: NonNullable<GlassCardProps['motionPreset']>;
  ambient: AmbientMotionTone;
  reducedMotion: boolean | null;
}) {
  const hoverTarget =
    options.motionPreset === 'hero'
      ? interactiveHeroLift
      : options.motionPreset === 'dense'
        ? { ...interactiveLift, y: -2, scale: 1.006 }
        : interactiveLift;
  const resolvedSurface = options.surface ?? (options.elevation === 'hero'
    ? 'hero'
    : options.elevation === 'raised'
      ? 'featured'
      : 'standard');
  const glowTone = options.tone === 'default' ? 'primary' : options.tone;
  const glowPalette = tonePalettes[glowTone];
  const ambientMotion = resolveAmbientMotion(options.ambient, { reducedMotion: Boolean(options.reducedMotion) });

  const toneClasses = {
    default: '',
    primary: tonePalettes.primary.card,
    accent: tonePalettes.accent.card,
    success: tonePalettes.success.card,
    warning: tonePalettes.warning.card,
    destructive: tonePalettes.destructive.card,
    normal: tonePalettes.normal.card,
    strict: tonePalettes.strict.card,
    reflection: tonePalettes.reflection.card,
    learn: tonePalettes.learn.card,
    penalty: tonePalettes.penalty.card,
    breathing: tonePalettes.breathing.card,
  } satisfies Record<NonNullable<GlassCardProps['tone']>, string>;

  const elevationClasses = {
    flat: '',
    raised: 'shadow-[0_18px_48px_hsl(var(--foreground)/0.06)]',
    hero: 'rounded-[2rem] shadow-[0_28px_80px_hsl(var(--foreground)/0.10)]',
  } satisfies Record<NonNullable<GlassCardProps['elevation']>, string>;

  const surfaceClasses = {
    standard: '',
    featured: 'bg-[linear-gradient(150deg,hsl(var(--surface-feature)/0.98),hsl(var(--card)/0.95))] border-[hsl(var(--border)/0.88)]',
    hero: 'rounded-[2rem] bg-[linear-gradient(145deg,hsl(var(--surface-hero)/0.99),hsl(var(--card)/0.94))] border-[hsl(var(--border)/0.84)] shadow-[0_28px_80px_hsl(var(--foreground)/0.1)]',
  } satisfies Record<NonNullable<NonNullable<GlassCardProps['surface']>>, string>;

  return {
    ambientMotion,
    cardClassName: cn(
      options.interactive ? 'glass-card-hover cursor-pointer' : 'glass-card',
      options.interactive && 'cta-sheen',
      elevationClasses[options.elevation],
      surfaceClasses[resolvedSurface],
      toneClasses[options.tone],
      options.highlight && 'premium-highlight',
      'p-4 sm:p-5',
      options.className,
    ),
    glowClassName: cn(
      'pointer-events-none absolute inset-x-[8%] top-0 h-24 rounded-full blur-2xl',
      glowPalette.glow,
    ),
    hoverTarget,
  };
}

interface GlassCardFrameProps extends HTMLMotionProps<'div'> {
  forwardedRef: ForwardedRef<HTMLDivElement>;
  interactive?: boolean;
  accentGlow: boolean;
  ambientMotion: ReturnType<typeof resolveAmbientMotion>;
  cardClassName: string;
  glowClassName: string;
  hoverTarget: NonNullable<HTMLMotionProps<'div'>['whileHover']>;
  children: ReactNode;
}

function GlassCardFrame({
  forwardedRef,
  interactive,
  accentGlow,
  ambientMotion,
  cardClassName,
  glowClassName,
  hoverTarget,
  children,
  ...props
}: GlassCardFrameProps) {
  return (
    <motion.div
      ref={forwardedRef}
      className={cardClassName}
      whileHover={interactive ? hoverTarget : undefined}
      whileTap={interactive ? interactiveTap : undefined}
      {...props}
    >
      {accentGlow ? (
        <motion.div
          aria-hidden="true"
          className={glowClassName}
          initial={false}
          animate={ambientMotion ?? { opacity: 0.22, y: 0, scale: 1 }}
        />
      ) : null}
      {children}
    </motion.div>
  );
}

function StaticGlassCard({
  className,
  interactive,
  tilt: _tilt,
  tone = 'default',
  elevation = 'flat',
  surface,
  highlight = false,
  accentGlow = false,
  motionPreset = 'soft',
  ambient = 'none',
  children,
  forwardedRef,
  reducedMotion,
  ...props
}: SharedGlassCardSurfaceProps) {
  const presentation = resolveGlassCardPresentation({
    className,
    interactive,
    tone,
    elevation,
    surface,
    highlight,
    accentGlow,
    motionPreset,
    ambient,
    reducedMotion,
  });

  return (
    <GlassCardFrame
      forwardedRef={forwardedRef}
      interactive={interactive}
      accentGlow={accentGlow}
      ambientMotion={presentation.ambientMotion}
      cardClassName={presentation.cardClassName}
      glowClassName={presentation.glowClassName}
      hoverTarget={presentation.hoverTarget}
      {...props}
    >
      {children}
    </GlassCardFrame>
  );
}

function TiltGlassCard({
  className,
  interactive,
  tilt: _tilt,
  tone = 'default',
  elevation = 'flat',
  surface,
  highlight = false,
  accentGlow = false,
  motionPreset = 'soft',
  ambient = 'none',
  children,
  forwardedRef,
  reducedMotion,
  onMouseMove,
  onMouseLeave,
  style,
  ...props
}: SharedGlassCardSurfaceProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [supportsFinePointer, setSupportsFinePointer] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [4, -4]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-4, 4]), { stiffness: 300, damping: 30 });
  const presentation = resolveGlassCardPresentation({
    className,
    interactive,
    tone,
    elevation,
    surface,
    highlight,
    accentGlow,
    motionPreset,
    ambient,
    reducedMotion,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia('(pointer: fine)');
    const update = () => setSupportsFinePointer(query.matches);

    update();
    query.addEventListener('change', update);

    return () => {
      query.removeEventListener('change', update);
    };
  }, []);

  const tiltEnabled = supportsFinePointer;
  const nextStyle: HTMLMotionProps<'div'>['style'] = tiltEnabled
    ? {
        ...(style ?? {}),
        rotateX,
        rotateY,
        transformPerspective: 800,
      }
    : style;

  return (
    <GlassCardFrame
      forwardedRef={(node) => {
        cardRef.current = node;
        setCardRef(node, forwardedRef);
      }}
      interactive={interactive}
      accentGlow={accentGlow}
      ambientMotion={presentation.ambientMotion}
      cardClassName={presentation.cardClassName}
      glowClassName={presentation.glowClassName}
      hoverTarget={presentation.hoverTarget}
      style={nextStyle}
      onMouseMove={(event) => {
        if (cardRef.current && tiltEnabled) {
          const rect = cardRef.current.getBoundingClientRect();
          mouseX.set((event.clientX - rect.left) / rect.width);
          mouseY.set((event.clientY - rect.top) / rect.height);
        }

        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        if (tiltEnabled) {
          mouseX.set(0.5);
          mouseY.set(0.5);
        }

        onMouseLeave?.(event);
      }}
      {...props}
    >
      {children}
    </GlassCardFrame>
  );
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>((props, ref) => {
  const reducedMotion = useReducedMotion();
  const shouldUseTiltSurface = Boolean(props.tilt && props.interactive && !reducedMotion);

  if (shouldUseTiltSurface) {
    return <TiltGlassCard {...props} forwardedRef={ref} reducedMotion={reducedMotion} />;
  }

  return <StaticGlassCard {...props} forwardedRef={ref} reducedMotion={reducedMotion} />;
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;
