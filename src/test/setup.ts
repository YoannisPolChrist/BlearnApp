import { cleanup, configure } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach } from "vitest";

// findBy*/waitFor haben per Default nur 1s Timeout. Unter Worker-Last dauert
// ein einzelner Render auf dieser Maschine gelegentlich laenger — das war die
// Hauptursache der rotierenden Gesamtlauf-Failures (alle Tests bestehen
// isoliert). Explizite timeout-Optionen in einzelnen Tests bleiben wirksam.
configure({ asyncUtilTimeout: 5_000 });

const testRuntime = globalThis as typeof globalThis & { __blearnRealDateNow?: typeof Date.now };
testRuntime.__blearnRealDateNow ??= Date.now;

afterEach(() => {
  cleanup();
  Object.defineProperty(Date, "now", {
    configurable: true,
    writable: true,
    value: testRuntime.__blearnRealDateNow,
  });
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});
