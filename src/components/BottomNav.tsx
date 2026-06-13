import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Shield, Brain, Settings2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { isBlockingRouteForBottomNav } from '@/lib/blockingOverlayRoutes';
import { ctaFollowThrough } from '@/lib/motion';
import { preloadRoute } from '@/lib/routeLoaders';

const BottomNav = forwardRef<HTMLDivElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowHoverMotion = !reducedMotion && !isMobile;
  const allowTapMotion = !reducedMotion;
  const allowActiveMotion = !reducedMotion;

  const navItems = [
    { path: '/', icon: Home, label: t('nav.focus') },
    { path: '/modes', icon: Shield, label: t('nav.modes') },
    { path: '/learn', icon: Brain, label: t('nav.learn') },
    { path: '/stats', icon: BarChart3, label: t('nav.stats') },
    { path: '/settings', icon: Settings2, label: t('nav.settings') },
  ];

  if (isBlockingRouteForBottomNav(location.pathname, location.search)) return null;

  return (
    <nav ref={ref} data-testid="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50" aria-label="Primary navigation">
      <div
        data-testid="bottom-nav-shell"
        className="bottom-nav-shell px-2"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        }}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 py-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <motion.button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                onPointerEnter={() => preloadRoute(item.path)}
                onTouchStart={() => preloadRoute(item.path)}
                onFocus={() => preloadRoute(item.path)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.1rem] px-1.5 py-1 transition-[background-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                  isActive ? 'bg-primary/10 shadow-[0_10px_28px_hsl(var(--primary)/0.1)]' : 'bg-transparent'
                }`}
                initial="rest"
                animate="rest"
                whileHover={allowHoverMotion ? 'hover' : 'rest'}
                whileTap={allowTapMotion ? 'tap' : 'rest'}
                variants={ctaFollowThrough}
              >
                <motion.div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-300 ${
                    isActive ? 'bg-primary/16 shadow-[0_10px_24px_hsl(var(--primary)/0.12)]' : 'bg-transparent'
                  }`}
                  animate={isActive && allowActiveMotion
                    ? {
                        scale: [1, 1.05, 1],
                        transition: { duration: 0.22, ease: 'easeOut' },
                      }
                    : { scale: 1 }}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={`transition-colors duration-300 ${
                      isActive ? 'text-primary' : 'text-foreground/62'
                    }`}
                  />
                </motion.div>
                <span
                  className={`max-w-full truncate text-[10px] font-bold uppercase tracking-[0.08em] transition-colors duration-300 ${
                    isActive ? 'text-primary' : 'text-foreground/62'
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';
export default BottomNav;
