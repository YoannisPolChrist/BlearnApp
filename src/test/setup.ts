import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach } from "vitest";

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
