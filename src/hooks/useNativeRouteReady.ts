import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isAndroidPlatform } from '@/lib/platform';
import { completeNativeRouteHandoff } from '@/lib/nativeRouteHandoff';

export function useNativeRouteReady() {
  const location = useLocation();

  useEffect(() => {
    if (!isAndroidPlatform) return;

    const overlaySessionId = new URLSearchParams(location.search).get('overlaySessionId');
    const frame = window.requestAnimationFrame(() => {
      void completeNativeRouteHandoff(overlaySessionId);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.search]);
}
