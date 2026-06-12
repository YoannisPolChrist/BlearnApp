import { useEffect, useMemo, useState } from 'react';
import {
  APP_LANGUAGE_TO_LOCALE,
  ensureLanguagePackAvailable,
  getLoadedLanguagePack,
  translateWithPack,
  type TranslationTree,
} from '@/lib/i18n';
import { DEFAULT_APP_LANGUAGE } from '@/lib/languages';
import { useAppStore } from '@/store/useAppStore';

const FALLBACK_INSTALLED_LANGUAGE_PACKS = [DEFAULT_APP_LANGUAGE];

export function useI18n() {
  const appLanguage = useAppStore((state) => state.appLanguage ?? DEFAULT_APP_LANGUAGE);
  const installedAppLanguagePacks = useAppStore((state) =>
    Array.isArray(state.installedAppLanguagePacks)
      ? state.installedAppLanguagePacks
      : FALLBACK_INSTALLED_LANGUAGE_PACKS,
  );

  const effectiveLanguage = useMemo(() => {
    return installedAppLanguagePacks.includes(appLanguage) ? appLanguage : DEFAULT_APP_LANGUAGE;
  }, [appLanguage, installedAppLanguagePacks]);
  const [translationPack, setTranslationPack] = useState<TranslationTree | undefined>(() =>
    getLoadedLanguagePack(effectiveLanguage) || getLoadedLanguagePack(DEFAULT_APP_LANGUAGE),
  );

  useEffect(() => {
    document.documentElement.lang = APP_LANGUAGE_TO_LOCALE[effectiveLanguage];
  }, [effectiveLanguage]);

  useEffect(() => {
    installedAppLanguagePacks.forEach((language) => {
      void ensureLanguagePackAvailable(language).catch((error) => {
        console.warn(`Language pack preload failed for ${language}:`, error);
      });
    });
  }, [installedAppLanguagePacks]);

  useEffect(() => {
    let active = true;
    const fallbackPack = getLoadedLanguagePack(DEFAULT_APP_LANGUAGE) as TranslationTree;

    setTranslationPack(getLoadedLanguagePack(effectiveLanguage) || fallbackPack);

    void ensureLanguagePackAvailable(effectiveLanguage)
      .then((nextPack) => {
        if (active) {
          setTranslationPack(nextPack);
        }
      })
      .catch(() => {
        if (active) {
          setTranslationPack(fallbackPack);
        }
      });

    return () => {
      active = false;
    };
  }, [effectiveLanguage]);

  return {
    language: effectiveLanguage,
    requestedLanguage: appLanguage,
    locale: APP_LANGUAGE_TO_LOCALE[effectiveLanguage],
    isUsingFallback: effectiveLanguage !== appLanguage,
    t: (key: string, params?: Record<string, string | number>) =>
      translateWithPack(
        translationPack || (getLoadedLanguagePack(DEFAULT_APP_LANGUAGE) as TranslationTree),
        key,
        params,
      ),
  };
}
