import type { TargetAndTransition, Transition, Variants } from 'framer-motion';

export type AmbientMotionTone = 'none' | 'subtle' | 'hero';

export const premiumEase = [0.16, 1, 0.3, 1] as [number, number, number, number];
export const settleEase = [0.22, 1, 0.36, 1] as [number, number, number, number];
export const exitEase = [0.4, 0, 1, 1] as [number, number, number, number];

export const motionDurations = {
  pressIn: 0.16,
  release: 0.2,
  cardEnter: 0.34,
  sectionEnter: 0.38,
  heroEnter: 0.42,
  exit: 0.16,
  modal: 0.3,
} as const;

export const heroTransition = {
  duration: motionDurations.heroEnter,
  ease: premiumEase,
};

export const springLift = {
  type: 'spring',
  stiffness: 360,
  damping: 26,
  mass: 0.8,
} as const satisfies Transition;

export const springTap = {
  type: 'spring',
  stiffness: 520,
  damping: 30,
  mass: 0.7,
} as const satisfies Transition;

export const interactiveLift: TargetAndTransition = {
  y: -4,
  scale: 1.01,
  transition: springLift,
};

export const interactiveHeroLift: TargetAndTransition = {
  y: -6,
  scale: 1.012,
  transition: springLift,
};

export const interactiveTap: TargetAndTransition = {
  y: 1,
  scale: 0.978,
  transition: springTap,
};

export const ctaFollowThrough = {
  rest: {
    scale: 1,
    y: 0,
    filter: 'brightness(1)',
  } satisfies TargetAndTransition,
  hover: {
    y: -2,
    scale: 1.018,
    filter: 'brightness(1.03)',
    transition: springLift,
  } satisfies TargetAndTransition,
  tap: {
    y: 1,
    scale: 0.972,
    filter: 'brightness(0.98)',
    transition: springTap,
  } satisfies TargetAndTransition,
  settle: {
    scale: [1, 1.026, 1],
    y: [0, -2, 0],
    transition: { duration: 0.42, ease: settleEase },
  } satisfies TargetAndTransition,
};

export const interactiveOnly = {
  rest: {
    scale: 1,
    y: 0,
    opacity: 1,
  } satisfies TargetAndTransition,
};

export const ambientAccent = {
  opacity: [0.16, 0.28, 0.16],
  y: [0, -2, 0],
  scale: [0.98, 1.02, 0.98],
  transition: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' },
} satisfies TargetAndTransition;

export const heroSignal = {
  opacity: [0.22, 0.38, 0.22],
  y: [0, -4, 0],
  scale: [0.97, 1.05, 0.97],
  transition: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
} satisfies TargetAndTransition;

export const statusPulse = {
  subtle: {
    scale: [1, 1.012, 1],
    y: [0, -3, 0],
    transition: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
  } satisfies TargetAndTransition,
  glow: {
    boxShadow: [
      '0 24px 70px rgba(4,30,22,0.54)',
      '0 32px 96px rgba(11,74,44,0.76)',
      '0 24px 70px rgba(4,30,22,0.54)',
    ],
    transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
  } satisfies TargetAndTransition,
  sweep: {
    x: ['-28%', '220%'],
    transition: { duration: 2.4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' },
  } satisfies TargetAndTransition,
};

export function resolveAmbientMotion(
  tone: AmbientMotionTone = 'none',
  options?: { reducedMotion?: boolean },
): TargetAndTransition | undefined {
  if (options?.reducedMotion || tone === 'none') {
    return undefined;
  }

  return tone === 'hero' ? heroSignal : ambientAccent;
}

export function getCenterWeightedDelay(index: number, total: number, minGap = 0.04, maxGap = 0.11) {
  if (total <= 1) return 0;
  const center = (total - 1) / 2;
  const distance = Math.abs(index - center);
  const normalized = center === 0 ? 0 : distance / center;
  return minGap + (1 - normalized) * (maxGap - minGap);
}

export function shouldAnimateDenseList(options: {
  reducedMotion?: boolean | null;
  isMobile?: boolean;
  itemCount: number;
  maxAnimatedItems?: number;
}) {
  const {
    reducedMotion = false,
    isMobile = false,
    itemCount,
    maxAnimatedItems = 14,
  } = options;

  return !reducedMotion && !isMobile && itemCount > 0 && itemCount <= maxAnimatedItems;
}

export const pageVariants: Record<'default' | 'hero' | 'overlay', Variants> = {
  default: {
    initial: {
      opacity: 0,
      y: 18,
      scale: 0.992,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: motionDurations.sectionEnter,
        ease: premiumEase,
        staggerChildren: 0.035,
      },
    },
    exit: {
      opacity: 0,
      y: -8,
      scale: 0.994,
      transition: {
        duration: motionDurations.exit,
        ease: exitEase,
      },
    },
  },
  hero: {
    initial: {
      opacity: 0,
      y: 22,
      scale: 0.988,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: motionDurations.heroEnter,
        ease: premiumEase,
        staggerChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.992,
      transition: {
        duration: motionDurations.exit,
        ease: exitEase,
      },
    },
  },
  overlay: {
    initial: {
      opacity: 0,
      scale: 0.985,
      y: 10,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: motionDurations.modal,
        ease: premiumEase,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.99,
      y: 6,
      transition: {
        duration: 0.14,
        ease: exitEase,
      },
    },
  },
};

export const mobilePageVariants: Record<'default' | 'hero' | 'overlay', Variants> = {
  default: {
    initial: {
      opacity: 0,
      y: 10,
      scale: 0.996,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.22,
        ease: premiumEase,
      },
    },
    exit: {
      opacity: 0,
      y: -6,
      scale: 0.998,
      transition: {
        duration: 0.12,
        ease: exitEase,
      },
    },
  },
  hero: {
    initial: {
      opacity: 0,
      y: 12,
      scale: 0.994,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.24,
        ease: premiumEase,
      },
    },
    exit: {
      opacity: 0,
      y: -8,
      scale: 0.996,
      transition: {
        duration: 0.12,
        ease: exitEase,
      },
    },
  },
  overlay: {
    initial: {
      opacity: 0,
      y: 8,
      scale: 0.994,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.2,
        ease: premiumEase,
      },
    },
    exit: {
      opacity: 0,
      y: 4,
      scale: 0.998,
      transition: {
        duration: 0.1,
        ease: exitEase,
      },
    },
  },
};

export const sectionStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
    },
  },
};

export const sectionItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.992 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionDurations.sectionEnter,
      ease: premiumEase,
    },
  },
};

export const heroContent: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.994 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionDurations.heroEnter,
      ease: premiumEase,
      staggerChildren: 0.09,
    },
  },
};

export const heroStat: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.988 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: premiumEase,
    },
  },
};

export const heroTimeline: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.1,
    },
  },
};

export const heroTimelineItem: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.986 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionDurations.heroEnter,
      ease: premiumEase,
    },
  },
};

export const cardCascade: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0.03,
      staggerChildren: 0.075,
    },
  },
};

export const cardCascadeItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.986 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionDurations.cardEnter,
      ease: premiumEase,
    },
  },
};

export const denseListStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const denseListItem: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.994 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
      ease: premiumEase,
    },
  },
};

export const chartReveal: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: premiumEase,
    },
  },
};

export const legendItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.22,
      ease: premiumEase,
    },
  },
};

export const modalSequence = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, ease: premiumEase } },
    exit: { opacity: 0, transition: { duration: 0.14, ease: exitEase } },
  },
  panel: {
    initial: { opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: motionDurations.modal, ease: premiumEase },
    },
    exit: {
      opacity: 0,
      y: 16,
      scale: 0.982,
      filter: 'blur(4px)',
      transition: { duration: 0.16, ease: exitEase },
    },
  },
  content: {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        delayChildren: 0.05,
        staggerChildren: 0.06,
      },
    },
  },
};
