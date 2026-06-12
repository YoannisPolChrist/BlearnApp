import { DEFAULT_APP_LANGUAGE, type SupportedAppLanguage, isLanguagePackBundled } from '@/lib/languages';
import dePack from '@/lib/i18n-packs/de';
import enPack from '@/lib/i18n-packs/en';
import frPack from '@/lib/i18n-packs/fr';

export type TranslationLeaf = string;
export type TranslationTree = {
  [key: string]: TranslationLeaf | TranslationTree;
};

export const APP_LANGUAGE_TO_LOCALE: Record<SupportedAppLanguage, string> = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  ar: 'ar-SA',
};

const loadedLanguagePacks = new Map<SupportedAppLanguage, TranslationTree>([
  ['de', dePack],
  ['en', enPack],
  ['fr', frPack],
]);
const loadingLanguagePacks = new Map<SupportedAppLanguage, Promise<TranslationTree>>();

const languagePackLoaders: Partial<Record<SupportedAppLanguage, () => Promise<{ default: TranslationTree }>>> = {
  es: () => import('@/lib/i18n-packs/es'),
  it: () => import('@/lib/i18n-packs/it'),
  ar: () => import('@/lib/i18n-packs/ar'),
};

function getTranslationValue(tree: TranslationTree, key: string): string | undefined {
  return key.split('.').reduce<TranslationLeaf | TranslationTree | undefined>((current, part) => {
    if (!current || typeof current === 'string') return current;
    return current[part];
  }, tree) as string | undefined;
}

export function getLoadedLanguagePack(language: SupportedAppLanguage): TranslationTree | undefined {
  return loadedLanguagePacks.get(language);
}

export async function ensureLanguagePackAvailable(language: SupportedAppLanguage): Promise<TranslationTree> {
  const safeLanguage = getSafeLanguage(language);
  const loadedPack = loadedLanguagePacks.get(safeLanguage);
  if (loadedPack) {
    return loadedPack;
  }

  if (isLanguagePackBundled(safeLanguage)) {
    return loadedLanguagePacks.get(DEFAULT_APP_LANGUAGE) as TranslationTree;
  }

  const pendingPack = loadingLanguagePacks.get(safeLanguage);
  if (pendingPack) {
    return pendingPack;
  }

  const loader = languagePackLoaders[safeLanguage];
  if (!loader) {
    throw new Error(`No downloadable language pack is configured for "${safeLanguage}".`);
  }

  const nextPackPromise = loader()
    .then((module) => {
      loadedLanguagePacks.set(safeLanguage, module.default);
      return module.default;
    })
    .finally(() => {
      loadingLanguagePacks.delete(safeLanguage);
    });

  loadingLanguagePacks.set(safeLanguage, nextPackPromise);

  return nextPackPromise;
}

export function getSafeLanguage(language: SupportedAppLanguage): SupportedAppLanguage {
  return APP_LANGUAGE_TO_LOCALE[language] ? language : DEFAULT_APP_LANGUAGE;
}

export function translateWithPack(
  pack: TranslationTree,
  key: string,
  params?: Record<string, string | number>,
): string {
  const fallbackPack = loadedLanguagePacks.get(DEFAULT_APP_LANGUAGE) as TranslationTree;
  const raw = getTranslationValue(pack, key) || getTranslationValue(fallbackPack, key) || key;

  if (!params) return raw;

  return Object.entries(params).reduce((result, [paramKey, value]) => {
    return result.replaceAll(`{${paramKey}}`, String(value));
  }, raw);
}

export function translate(
  language: SupportedAppLanguage,
  key: string,
  params?: Record<string, string | number>,
): string {
  const activePack = getLoadedLanguagePack(getSafeLanguage(language)) || dePack;
  return translateWithPack(activePack, key, params);
}
