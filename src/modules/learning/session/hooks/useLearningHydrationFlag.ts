import { useEffect, useState } from 'react';
import { useLearningStore } from '@/store/useLearningStore';

export function useLearningHydrationFlag() {
  const [learningHydrated, setLearningHydrated] = useState(() => useLearningStore.persist.hasHydrated());

  useEffect(() => {
    if (useLearningStore.persist.hasHydrated()) {
      setLearningHydrated(true);
      return undefined;
    }

    return useLearningStore.persist.onFinishHydration(() => {
      setLearningHydrated(true);
    });
  }, []);

  return learningHydrated;
}
