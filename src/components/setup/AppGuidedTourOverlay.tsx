import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppTourStep } from '@/components/setup/appTourSteps';
import { triggerHapticFeedback } from '@/lib/haptics';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  step: AppTourStep;
  stepIndex: number;
  totalSteps: number;
  onStepChange: (index: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}

const SPOTLIGHT_GUTTER = 10;
const TOUR_TARGET_GAP = 20;
const VIEWPORT_GUTTER = 16;

function getBottomNavigationTop() {
  const navigation = document.querySelector<HTMLElement>('[data-tour-id="tour-bottom-nav"]');
  return navigation?.getBoundingClientRect().top ?? window.innerHeight;
}

function keepTargetInsideTourViewport(target: HTMLElement, panel: HTMLElement | null, panelAtTop: boolean) {
  if (window.getComputedStyle(target).position === 'fixed') return;

  const targetRect = target.getBoundingClientRect();
  const panelRect = panel?.getBoundingClientRect();
  const top = panelAtTop
    ? Math.max(VIEWPORT_GUTTER, (panelRect?.bottom ?? 0) + TOUR_TARGET_GAP)
    : VIEWPORT_GUTTER;
  const bottom = Math.min(
    getBottomNavigationTop() - TOUR_TARGET_GAP,
    panelAtTop
      ? window.innerHeight - VIEWPORT_GUTTER
      : (panelRect?.top ?? window.innerHeight) - TOUR_TARGET_GAP,
  );

  if (top >= bottom) return;

  const targetFits = targetRect.height <= bottom - top;
  const targetIsVisible = targetRect.top >= top && targetRect.bottom <= bottom;
  if (targetIsVisible) return;

  const scrollTop = targetFits
    ? targetRect.top - top
    : targetRect.top - VIEWPORT_GUTTER;

  window.scrollBy({ top: Math.round(scrollTop), left: 0, behavior: 'auto' });
}

function isStepRouteActive(
  location: { pathname: string; search: string },
  route: string,
) {
  const [pathname, query] = route.split('?');
  return location.pathname === pathname
    && location.search === (query ? `?${query}` : '');
}

function readTargetRect(target: HTMLElement): SpotlightRect | null {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const top = Math.max(8, rect.top - SPOTLIGHT_GUTTER);
  const left = Math.max(8, rect.left - SPOTLIGHT_GUTTER);
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + SPOTLIGHT_GUTTER);
  const right = Math.min(window.innerWidth - 8, rect.right + SPOTLIGHT_GUTTER);

  if (bottom <= top || right <= left) return null;

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}

function isSameSpotlight(left: SpotlightRect | null, right: SpotlightRect | null) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    Math.abs(left.top - right.top) < 0.5
    && Math.abs(left.left - right.left) < 0.5
    && Math.abs(left.width - right.width) < 0.5
    && Math.abs(left.height - right.height) < 0.5
  );
}

export default function AppGuidedTourOverlay({
  step,
  stepIndex,
  totalSteps,
  onStepChange,
  onComplete,
  onSkip,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isStepRouteReady = isStepRouteActive(location, step.route);
  const panelAtTop = step.placement === 'top';

  useEffect(() => {
    if (!isStepRouteReady) {
      setSpotlight(null);
      navigate(step.route, { replace: true });
    }
  }, [isStepRouteReady, navigate, step.route]);

  useLayoutEffect(() => {
    if (!isStepRouteReady) {
      return undefined;
    }

    if (!step.targetId) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      setSpotlight(null);
      return undefined;
    }

    let frameId = 0;
    let trackingFrames = 0;
    let observedTarget: HTMLElement | null = null;
    let observer: ResizeObserver | undefined;
    let layoutObserver: ResizeObserver | undefined;
    let mutationObserver: MutationObserver | undefined;

    const scheduleTracking = (frames = 120) => {
      trackingFrames = Math.max(trackingFrames, frames);
      if (!frameId) {
        frameId = window.requestAnimationFrame(updateSpotlight);
      }
    };

    const updateSpotlight = () => {
      frameId = 0;
      const target = step.targetId
        ? document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`)
        : null;

      if (target) {
        keepTargetInsideTourViewport(target, panelRef.current, panelAtTop);
      }

      const nextSpotlight = target ? readTargetRect(target) : null;
      setSpotlight((previousSpotlight) => (
        isSameSpotlight(previousSpotlight, nextSpotlight)
          ? previousSpotlight
          : nextSpotlight
      ));

      if (target && target !== observedTarget && typeof ResizeObserver !== 'undefined') {
        observer?.disconnect();
        observer = new ResizeObserver(() => scheduleTracking());
        observer.observe(target);
        observedTarget = target;
      }

      // getBoundingClientRect() follows layout and transform animation. A
      // bounded frame window avoids a permanent animation loop while keeping
      // the frame attached as a target settles into its final position.
      if (trackingFrames > 0) {
        trackingFrames -= 1;
        frameId = window.requestAnimationFrame(updateSpotlight);
      }
    };

    const updateFromViewport = () => scheduleTracking();
    scheduleTracking(120);
    window.addEventListener('resize', updateFromViewport);
    window.addEventListener('orientationchange', updateFromViewport);
    window.addEventListener('scroll', updateFromViewport, true);
    if (typeof ResizeObserver !== 'undefined') {
      layoutObserver = new ResizeObserver(() => scheduleTracking());
      layoutObserver.observe(document.documentElement);
      if (panelRef.current) layoutObserver.observe(panelRef.current);
    }
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => scheduleTracking());
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      layoutObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', updateFromViewport);
      window.removeEventListener('orientationchange', updateFromViewport);
      window.removeEventListener('scroll', updateFromViewport, true);
    };
  }, [isStepRouteReady, panelAtTop, reducedMotion, step.id, step.targetId]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const handleAdvance = () => {
    if (!reducedMotion) triggerHapticFeedback('action');

    if (isLast) {
      onComplete();
      return;
    }

    onStepChange(stepIndex + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tour-title"
      aria-describedby="app-tour-description"
    >
      {spotlight ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[1.65rem] border-2 border-primary/80 bg-primary/[0.035] shadow-[0_0_0_9999px_hsl(var(--foreground)/0.72),0_0_0_5px_hsl(var(--primary)/0.16),0_0_32px_hsl(var(--primary)/0.38)]"
          initial={false}
          animate={spotlight}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}

      <AnimatePresence mode="wait">
        <motion.section
          ref={panelRef}
          key={step.id}
          className={`absolute left-4 right-4 mx-auto max-w-xl rounded-[1.7rem] border border-border/70 bg-card/95 p-4 shadow-[0_24px_72px_hsl(var(--foreground)/0.28)] backdrop-blur-xl sm:p-5 ${panelAtTop ? 'top-[max(env(safe-area-inset-top,0px),1rem)]' : 'bottom-[max(env(safe-area-inset-bottom,0px),1rem)]'}`}
          initial={{ opacity: 0, y: panelAtTop ? -12 : 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: panelAtTop ? -10 : 10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  {step.eyebrow} · {stepIndex + 1}/{totalSteps}
                </p>
                <h2 id="app-tour-title" className="mt-1 text-lg font-black tracking-[-0.035em] text-foreground">
                  {step.title}
                </h2>
              </div>
            </div>
            <button type="button" onClick={onSkip} className="shrink-0 rounded-xl px-2 py-1 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Überspringen
            </button>
          </div>

          <p id="app-tour-description" className="mt-3 text-sm leading-6 text-foreground/78">
            {step.description}
          </p>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => onStepChange(stepIndex - 1)} disabled={isFirst} className="btn-press inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-foreground disabled:invisible">
              <ArrowLeft size={16} />
              Zurück
            </button>
            <motion.button
              type="button"
              onClick={handleAdvance}
              whileTap={reducedMotion ? undefined : { scale: 0.96, x: [0, -1.5, 1.5, 0] }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="btn-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_12px_28px_hsl(var(--primary)/0.24)]"
            >
              {isLast ? 'Schutz einrichten' : 'Weiter'}
              {!isLast ? <ArrowRight size={16} /> : null}
            </motion.button>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
