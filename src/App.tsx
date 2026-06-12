import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MotionConfig } from "framer-motion";
import { BookOpen, Globe, Shield, Waves } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SuccessFeedbackHost } from "@/components/ui/SuccessFeedbackHost";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import AndroidOnlyAppScreen from "./components/AndroidOnlyAppScreen";
import BottomNav from "./components/BottomNav";
import { BlockingLoadingShell } from "./components/blocking/BlockingLoadingShell";
import { AppTourProvider } from "./components/setup/AppTourProvider";
import { APP_TOUR_STEPS } from "./components/setup/appTourSteps";
import { useNativePendingNavigation } from "./hooks/useNativePendingNavigation";
import { usePersistFlushOnHide } from "./hooks/usePersistFlushOnHide";
import { isBlockingOverlayRoute, isBlockingRoutePath } from "./lib/blockingOverlayRoutes";
import { completeNativeRouteHandoff } from "./lib/nativeRouteHandoff";
import { recordNativeOverlayRuntimeEvent } from "./lib/nativeOverlayRuntime";
import { isAndroidPlatform } from "./lib/platform";
import { ROUTER_FUTURE_FLAGS } from "./lib/routerFuture";
import { preloadCriticalBlockingRoutes, routeLoaders } from "./lib/routeLoaders";
import { getModePalette } from "./lib/semanticTones";

const GlobalRuntimeManagers = lazy(() => import("./components/runtime/GlobalRuntimeManagers"));
const AppIntroDialog = lazy(() => import("./components/setup/AppIntroDialog"));
const AuthDialog = lazy(() => import("./components/setup/AuthDialog").then((module) => ({ default: module.AuthDialog })));
const Index = lazy(routeLoaders.index);
const Intervention = lazy(routeLoaders.intervention);
const Breathing = lazy(routeLoaders.breathing);
const Checkin = lazy(routeLoaders.checkin);
const Stats = lazy(routeLoaders.stats);
const Modes = lazy(routeLoaders.modes);
const Pause = lazy(routeLoaders.pause);
const AppSettings = lazy(routeLoaders.settings);
const ScreenTime = lazy(routeLoaders.screenTime);
const Learn = lazy(routeLoaders.learn);
const LearnTemplates = lazy(routeLoaders.learnTemplates);
const LearnBrowser = lazy(routeLoaders.learnBrowser);
const LearnFilteredDeck = lazy(routeLoaders.learnFilteredDeck);
const LearnReview = lazy(routeLoaders.learnReview);
const Wallet = lazy(routeLoaders.wallet);
const NotFound = lazy(routeLoaders.notFound);

const queryClient = new QueryClient();
const allowWebRuntime = import.meta.env.VITE_ALLOW_WEB_RUNTIME === "true";
const PASSIVE_AUTH_PROMPT_COOLDOWN_MS = 1600;

function BlockingOverlayChromeManager() {
  const location = useLocation();

  useEffect(() => {
    const blockingOverlayVisible =
      isAndroidPlatform && isBlockingOverlayRoute(location.pathname, location.search);

    document.body.classList.toggle("native-blocking-overlay", blockingOverlayVisible);

    return () => {
      document.body.classList.remove("native-blocking-overlay");
    };
  }, [location.pathname, location.search]);

  return null;
}

function MainAppShell({ hideChrome }: { hideChrome: boolean }) {
  const location = useLocation();
  const suspenseFallback = isBlockingOverlayRoute(location.pathname, location.search)
    ? null
    : <RouteLoadingFallback pathname={location.pathname} />;

  return (
    <>
      <div className="relative z-10">
        <Suspense fallback={suspenseFallback}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Index />} />
              <Route path="/intervention" element={<Intervention />} />
              <Route path="/breathing" element={<Breathing />} />
              <Route path="/checkin" element={<Checkin />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/modes" element={<Modes />} />
              <Route path="/pause" element={<Pause />} />
              <Route path="/settings" element={<AppSettings />} />
              <Route path="/screentime" element={<ScreenTime />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/learn/templates" element={<LearnTemplates />} />
              <Route path="/learn/browser" element={<LearnBrowser />} />
              <Route path="/learn/filtered" element={<LearnFilteredDeck />} />
              <Route path="/learn/review" element={<LearnReview />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        {!hideChrome && <BottomNav />}
      </div>
      {!hideChrome && (
        <Suspense fallback={null}>
          <AppIntroDialog />
        </Suspense>
      )}
    </>
  );
}

function AppInner() {
  const location = useLocation();
  usePersistFlushOnHide();
  const pendingBlockingNavigationState = useNativePendingNavigation();
  const pendingBlockingNavigation = pendingBlockingNavigationState.active;
  const overlaySessionId = new URLSearchParams(location.search).get("overlaySessionId");
  const isBlockingRoute = isBlockingRoutePath(location.pathname);
  const blockingExperienceActive =
    pendingBlockingNavigationState.priming
    || pendingBlockingNavigationState.active
    || pendingBlockingNavigationState.handoffActive;
  const shouldShowBlockingTransitionFallback =
    !isBlockingRoute
    && pendingBlockingNavigationState.fallbackVisible;
  const shouldHoldForNativeBlockingHandoff =
    !isBlockingRoute
    && !shouldShowBlockingTransitionFallback
    && (pendingBlockingNavigationState.active || pendingBlockingNavigationState.handoffActive);
  const shouldRunRuntimeManagers = (isAndroidPlatform || allowWebRuntime)
    && !isBlockingRoute
    && !blockingExperienceActive;
  const recentlyBlockedRef = useRef(pendingBlockingNavigation || isBlockingRoute);
  const completedOverlaySessionRef = useRef<string | null>(null);
  const [suppressPassiveAuthPrompt, setSuppressPassiveAuthPrompt] = useState(
    () => pendingBlockingNavigation || isBlockingRoute || pendingBlockingNavigationState.priming,
  );

  useEffect(() => {
    if (!isAndroidPlatform) {
      return;
    }

    void preloadCriticalBlockingRoutes().catch((error) => {
      console.warn("Critical blocking routes could not be preloaded:", error);
    });
  }, []);

  useEffect(() => {
    if (pendingBlockingNavigationState.priming) {
      setSuppressPassiveAuthPrompt(true);
      return undefined;
    }

    if (pendingBlockingNavigation || isBlockingRoute) {
      recentlyBlockedRef.current = true;
      setSuppressPassiveAuthPrompt(true);
      return undefined;
    }

    if (!recentlyBlockedRef.current) {
      setSuppressPassiveAuthPrompt(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      recentlyBlockedRef.current = false;
      setSuppressPassiveAuthPrompt(false);
    }, PASSIVE_AUTH_PROMPT_COOLDOWN_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isBlockingRoute, pendingBlockingNavigation, pendingBlockingNavigationState.priming]);

  useEffect(() => {
    if (!isBlockingRoute || !overlaySessionId) {
      completedOverlaySessionRef.current = null;
    }
  }, [isBlockingRoute, overlaySessionId, location.pathname, location.search]);

  useEffect(() => {
    if (!isAndroidPlatform || !isBlockingRoute || !overlaySessionId) {
      return undefined;
    }

    if (completedOverlaySessionRef.current === overlaySessionId) {
      return undefined;
    }

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      completedOverlaySessionRef.current = overlaySessionId;
      recordNativeOverlayRuntimeEvent({
        stage: 'overlay-session',
        source: 'app',
        message: 'blocking overlay session mounted in the app shell',
        route: `${location.pathname}${location.search}`,
        overlaySessionId,
      });
      recordNativeOverlayRuntimeEvent({
        stage: 'route-mounted',
        source: 'app',
        message: 'blocking route mounted and is ready to complete the native handoff',
        route: `${location.pathname}${location.search}`,
        overlaySessionId,
      });

      void completeNativeRouteHandoff(overlaySessionId).then(() => {
        if (!cancelled) {
          recordNativeOverlayRuntimeEvent({
            stage: 'handoff-complete',
            source: 'app',
            message: 'native route handoff completed from the app shell',
            route: `${location.pathname}${location.search}`,
            overlaySessionId,
          });
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [isBlockingRoute, overlaySessionId, location.pathname, location.search]);

  if (!isAndroidPlatform && !allowWebRuntime) {
    return <AndroidOnlyAppScreen />;
  }

  const shell = shouldShowBlockingTransitionFallback
    ? (
      <BlockingLoadingShell
        mode={pendingBlockingNavigationState.mode}
        title="Blearn schützt gerade deinen Fokus"
        body="Der Blocking-Flow braucht etwas länger als sonst. Blearn hält die Übergabe stabil."
      />
    )
    : shouldHoldForNativeBlockingHandoff
      ? <div aria-hidden="true" data-testid="blocking-handoff-shell" className="min-h-screen w-full bg-transparent" />
    : (
      <>
        <BlockingOverlayChromeManager />
        <MainAppShell hideChrome={isBlockingRoute} />
      </>
    );

  return (
    <>
      <Suspense fallback={null}>
        <GlobalRuntimeManagers enabled={shouldRunRuntimeManagers} />
      </Suspense>
      {shell}
      <Suspense fallback={null}>
        <AuthDialog suppressPassiveOnboarding={suppressPassiveAuthPrompt} />
      </Suspense>
    </>
  );
}

function resolveRouteLoadingPath(route: string | undefined, fallbackPathname: string) {
  if (!route) {
    return fallbackPathname;
  }

  const normalizedRoute = route.startsWith('/') ? route : `/${route.replace(/^#?\/?/, '')}`;
  return new URL(normalizedRoute, 'https://blearn.local').pathname;
}

function resolveRouteLoadingFallback(pathname: string) {
  if (pathname.startsWith('/learn')) {
    return {
      mode: 'learn' as const,
      eyebrow: 'Learn',
      title: 'Lernbereich wird geladen',
      body: 'Blearn bereitet Karten, Decks und deine nächste Session vor.',
      icon: <BookOpen size={28} />,
    };
  }

  if (pathname === '/intervention' || pathname === '/breathing' || pathname === '/checkin') {
    return {
      mode: 'reflection' as const,
      eyebrow: 'Fokus-Flow',
      title: 'Dein Fokus-Flow wird geladen',
      body: 'Der nächste Schritt ist gleich bereit.',
      icon: <Waves size={28} />,
    };
  }

  if (pathname === '/stats' || pathname === '/screentime') {
    return {
      mode: 'normal' as const,
      eyebrow: 'Übersicht',
      title: 'Daten werden geladen',
      body: 'Blearn bereitet deine aktuelle Auswertung vor.',
      icon: <Globe size={28} />,
    };
  }

  return {
    mode: 'normal' as const,
    eyebrow: 'Blearn',
    title: 'Bereich wird geladen',
    body: 'Die nächste Ansicht steht gleich bereit.',
    icon: <Shield size={28} />,
  };
}

function RouteLoadingFallback({ pathname }: { pathname: string }) {
  const fallback = resolveRouteLoadingFallback(pathname);
  const palette = getModePalette(fallback.mode);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="route-loading-fallback"
      className="mx-auto flex min-h-screen w-full max-w-md items-start justify-center px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="w-full rounded-[1.7rem] border border-border/70 bg-card/96 p-5 shadow-[0_14px_38px_hsl(var(--foreground)/0.07)] sm:p-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${palette.icon}`}>
            {fallback.icon}
          </div>
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${palette.text}`}>
              {fallback.eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-foreground">
              {fallback.title}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/72">
          {fallback.body}
        </p>

        <div className="mt-5 space-y-2.5">
          <div className="h-2.5 w-3/4 rounded-full bg-muted/60" />
          <div className="h-2.5 w-full rounded-full bg-muted/42" />
          <div className="h-2.5 w-2/3 rounded-full bg-muted/34" />
        </div>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
        <Toaster />
        <Sonner />
        <SuccessFeedbackHost />
        <HashRouter future={ROUTER_FUTURE_FLAGS}>
          <AppTourProvider steps={APP_TOUR_STEPS}>
            <AppInner />
          </AppTourProvider>
        </HashRouter>
      </MotionConfig>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
