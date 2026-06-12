import { useEffect, useRef, useState } from 'react';

export function useInlineFeedback<T>(durationMs = 1100) {
  const [value, setValue] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clear = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setValue(null);
  };

  const trigger = (nextValue: T) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setValue(nextValue);
    timeoutRef.current = window.setTimeout(() => {
      setValue(null);
      timeoutRef.current = null;
    }, durationMs);
  };

  useEffect(() => clear, []);

  return {
    value,
    active: value !== null,
    clear,
    trigger,
  };
}
