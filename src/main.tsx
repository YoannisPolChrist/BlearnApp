import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { isNativePlatform } from "@/lib/platform";
import "./index.css";

const NATIVE_CACHE_RESET_KEY = "blearn-native-cache-reset-v2";
const App = lazy(() => import("./App.tsx"));
const rootErrorStyle =
  "min-h-screen w-full bg-background px-5 py-8 text-foreground";
const rootErrorCardStyle =
  "mx-auto flex w-full max-w-lg flex-col gap-4 rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-[0_18px_50px_hsl(var(--foreground)/0.08)]";

type RootErrorBoundaryState = {
  error: Error | null;
  eventError: Error | null;
};

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    error: null,
    eventError: null,
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentStack = typeof errorInfo.componentStack === "string"
      ? errorInfo.componentStack
      : JSON.stringify(errorInfo);
    console.error(
      `Root render failed: ${error.stack || error.message || "Unknown error"}\nComponent stack:${componentStack}`,
    );
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return {
      error,
      eventError: null,
    };
  }

  handleWindowError = (event: ErrorEvent) => {
    const nextError = event.error instanceof Error
      ? event.error
      : new Error(event.message || "Unknown window error");
    this.setState((currentState) => currentState.error
      ? currentState
      : { error: null, eventError: nextError });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const nextError = reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");
    this.setState((currentState) => currentState.error
      ? currentState
      : { error: null, eventError: nextError });
  };

  render() {
    const visibleError = this.state.error || this.state.eventError;
    if (!visibleError) {
      return this.props.children;
    }

    return (
      <div className={rootErrorStyle}>
        <div className={rootErrorCardStyle}>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-destructive">
              App-Startfehler
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
              Blearn konnte die Ansicht nicht laden
            </h1>
          </div>

          <p className="text-sm leading-relaxed text-foreground/78">
            Statt eines Whitescreens zeigen wir jetzt den konkreten Fehler, damit der Startpfad schnell repariert werden kann.
          </p>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-foreground">
              {visibleError.message || "Unbekannter Fehler"}
            </p>
            {visibleError.stack ? (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/70">
                {visibleError.stack}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}

if (isNativePlatform) {
  let shouldResetNativeCaches = true;

  try {
    shouldResetNativeCaches = window.localStorage.getItem(NATIVE_CACHE_RESET_KEY) !== "true";
    if (shouldResetNativeCaches) {
      window.localStorage.setItem(NATIVE_CACHE_RESET_KEY, "true");
    }
  } catch {
    shouldResetNativeCaches = true;
  }

  if (shouldResetNativeCaches) {
    void window.navigator.serviceWorker?.getRegistrations?.().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    );

    const cacheStorage = 'caches' in window ? window.caches : undefined;
    void cacheStorage?.keys?.().then((cacheNames) =>
      Promise.all(cacheNames.map((cacheName) => cacheStorage.delete(cacheName))),
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" storageKey="mindful-theme">
    <RootErrorBoundary>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </RootErrorBoundary>
  </ThemeProvider>
);
