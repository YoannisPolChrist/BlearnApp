import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { AppTourContext, type AppTourContextValue } from '@/components/setup/appTourContext';
import type { AppTourStep } from '@/components/setup/appTourSteps';
import {
  APP_TOUR_DISMISSED_STORAGE_KEY,
  FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY,
} from '@/components/setup/appTourStorage';
import { isBlockingOverlayRoute } from '@/lib/blockingOverlayRoutes';
import { useAppStore } from '@/store/useAppStore';

const AUTO_OPEN_POLL_MS = 120;

function hasDismissedAppTour() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(APP_TOUR_DISMISSED_STORAGE_KEY) === 'true';
}

function persistAppTourDismissed() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(APP_TOUR_DISMISSED_STORAGE_KEY, 'true');
}

function hasSeenFirstLaunchAnimation() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY) === 'true';
}

function persistFirstLaunchAnimationSeen() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY, 'true');
}

function isNativeHandoffActive() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __blearnNativeHandoffActive?: boolean }).__blearnNativeHandoffActive);
}

interface Props {
  children: ReactNode;
  steps: AppTourStep[];
}

export function AppTourProvider({ children, steps }: Props) {
  const location = useLocation();
  const appIntroSeen = useAppStore((state) => state.appIntroSeen);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const setAppIntroSeen = useAppStore((state) => state.setAppIntroSeen);
  const [dismissedInStorage, setDismissedInStorage] = useState(() => hasDismissedAppTour());
  const [firstLaunchAnimationSeen, setFirstLaunchAnimationSeen] = useState(() =>
    hasSeenFirstLaunchAnimation(),
  );
  const isBlockingOverlayRouteActive = isBlockingOverlayRoute(location.pathname, location.search);
  const shouldAutoOpen =
    hasHydrated
    && !dismissedInStorage
    && !appIntroSeen
    && location.pathname === '/'
    && !isBlockingOverlayRouteActive;
  const [isOpen, setIsOpen] = useState(false);
  const [isFirstLaunchAnimationActive, setIsFirstLaunchAnimationActive] = useState(false);
  const [autoOpenReady, setAutoOpenReady] = useState(() => !shouldAutoOpen);
  const [currentStepIndex, setCurrentStepIndexState] = useState(0);

  const closeTour = useCallback(() => {
    persistAppTourDismissed();
    setDismissedInStorage(true);
    setIsOpen(false);
    setCurrentStepIndexState(0);
    setAppIntroSeen(true);
  }, [setAppIntroSeen]);

  const openTour = useCallback(() => {
    setCurrentStepIndexState(0);
    setIsOpen(true);
  }, []);

  const completeFirstLaunchAnimation = useCallback(() => {
    setIsFirstLaunchAnimationActive(false);
    if (shouldAutoOpen) {
      openTour();
    }
  }, [openTour, shouldAutoOpen]);

  const setCurrentStepIndex = useCallback(
    (index: number) => {
      setCurrentStepIndexState(Math.max(0, Math.min(index, Math.max(steps.length - 1, 0))));
    },
    [steps.length],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncDismissedState = () => {
      setDismissedInStorage(hasDismissedAppTour());
    };

    window.addEventListener('storage', syncDismissedState);
    return () => {
      window.removeEventListener('storage', syncDismissedState);
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoOpen) {
      setAutoOpenReady(true);
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    setAutoOpenReady(false);

    const waitForStableDashboard = () => {
      if (cancelled) {
        return;
      }

      if (isNativeHandoffActive()) {
        timeoutId = window.setTimeout(waitForStableDashboard, AUTO_OPEN_POLL_MS);
        return;
      }

      setAutoOpenReady(true);
    };

    timeoutId = window.setTimeout(waitForStableDashboard, AUTO_OPEN_POLL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [shouldAutoOpen]);

  useEffect(() => {
    if (
      !shouldAutoOpen ||
      !autoOpenReady ||
      isOpen ||
      isFirstLaunchAnimationActive
    ) {
      return;
    }

    if (!firstLaunchAnimationSeen) {
      persistFirstLaunchAnimationSeen();
      setFirstLaunchAnimationSeen(true);
      setIsFirstLaunchAnimationActive(true);
      return;
    }

    openTour();
  }, [
    autoOpenReady,
    firstLaunchAnimationSeen,
    isFirstLaunchAnimationActive,
    isOpen,
    openTour,
    shouldAutoOpen,
  ]);

  useEffect(() => {
    if (!shouldAutoOpen) {
      setIsFirstLaunchAnimationActive(false);
    }
  }, [shouldAutoOpen]);

  const currentStep = isOpen ? steps[currentStepIndex] ?? null : null;

  const value = useMemo<AppTourContextValue>(
    () => ({
      isOpen,
      isFirstLaunchAnimationActive,
      currentStep,
      currentStepId: currentStep?.id ?? null,
      currentStepIndex,
      currentTargetId: currentStep?.targetId ?? null,
      currentRoute: currentStep?.route ?? null,
      totalSteps: steps.length,
      openTour,
      closeTour,
      completeFirstLaunchAnimation,
      setCurrentStepIndex,
      isTargetActive: (targetId: string) => Boolean(isOpen && currentStep?.targetId === targetId),
    }),
    [
      closeTour,
      completeFirstLaunchAnimation,
      currentStep,
      currentStepIndex,
      isFirstLaunchAnimationActive,
      isOpen,
      openTour,
      setCurrentStepIndex,
      steps.length,
    ],
  );

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}
