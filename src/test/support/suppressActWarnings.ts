import { vi } from 'vitest';

function buildConsoleMessage(args: unknown[]) {
  return args
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      if (value instanceof Error) {
        return value.message;
      }

      return String(value);
    })
    .join(' ');
}

export function suppressKnownActWarnings() {
  const originalConsoleError = console.error;

  return vi.spyOn(console, 'error').mockImplementation((...args: Parameters<typeof console.error>) => {
    const message = buildConsoleMessage(args);
    if (message.includes('not wrapped in act(...))') || message.includes('not wrapped in act(...)')) {
      return;
    }

    originalConsoleError(...args);
  });
}
