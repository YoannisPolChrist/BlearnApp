import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { mobilePageVariants, pageVariants } from '@/lib/motion';

export default function PageTransition({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'hero' | 'overlay';
}) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  if (reducedMotion) {
    return <div className="page-shell-clip min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">{children}</div>;
  }

  const variants = isMobile ? mobilePageVariants[variant] : pageVariants[variant];

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="page-shell-clip min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
    >
      {children}
    </motion.div>
  );
}
