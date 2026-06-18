import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { pageVariants } from '@/lib/motion';

export default function PageTransition({
  children,
  disableMotion = false,
  variant = 'default',
}: {
  children: ReactNode;
  disableMotion?: boolean;
  variant?: 'default' | 'hero' | 'overlay';
}) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // Auf Mobile (Android-WebView) kostet jede Navigation eine Enter+Exit-Animation
  // über <AnimatePresence mode="wait"> — das blockiert den Main-Thread und fügt
  // Warte-Latenz hinzu (sichtbares Ruckeln, obwohl die GPU idle ist). Auf Mobile
  // daher ohne Transition rendern; das Layout bleibt identisch. Desktop behält die
  // Animation.
  if (reducedMotion || disableMotion || isMobile) {
    return <div className="page-shell-clip min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">{children}</div>;
  }

  const variants = pageVariants[variant];

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
