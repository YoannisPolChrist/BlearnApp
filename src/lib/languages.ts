export const APP_LANGUAGE_PACKS = [
  {
    value: 'de',
    label: 'Deutsch',
    availability: 'bundled',
  },
  {
    value: 'en',
    label: 'English',
    availability: 'bundled',
  },
  {
    value: 'fr',
    label: 'Français',
    availability: 'bundled',
  },
  {
    value: 'es',
    label: 'Español',
    availability: 'downloadable',
  },
  {
    value: 'it',
    label: 'Italiano',
    availability: 'downloadable',
  },
  {
    value: 'ar',
    label: 'Arabic',
    availability: 'downloadable',
  },
] as const;

export type SupportedAppLanguage = (typeof APP_LANGUAGE_PACKS)[number]['value'];
export type AppLanguagePackAvailability = (typeof APP_LANGUAGE_PACKS)[number]['availability'];

export const DEFAULT_APP_LANGUAGE: SupportedAppLanguage = 'de';

export const APP_LANGUAGE_OPTIONS = APP_LANGUAGE_PACKS.map(({ value, label }) => ({
  value,
  label,
})) as ReadonlyArray<{ value: SupportedAppLanguage; label: string }>;

export const LEARNING_LANGUAGE_OPTIONS = [...APP_LANGUAGE_OPTIONS] as const;
export const BUNDLED_APP_LANGUAGE_PACKS = APP_LANGUAGE_PACKS.filter(
  (pack) => pack.availability === 'bundled',
) as typeof APP_LANGUAGE_PACKS;
export const DOWNLOADABLE_APP_LANGUAGE_PACKS = APP_LANGUAGE_PACKS.filter(
  (pack) => pack.availability === 'downloadable',
) as typeof APP_LANGUAGE_PACKS;

export function getLanguageLabel(language: string): string {
  return APP_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || language.toUpperCase();
}

export function getLanguagePack(language: string) {
  return APP_LANGUAGE_PACKS.find((pack) => pack.value === language);
}

export function isLanguagePackBundled(language: string): boolean {
  return getLanguagePack(language)?.availability === 'bundled';
}

export function isLanguagePackDownloadable(language: string): boolean {
  return getLanguagePack(language)?.availability === 'downloadable';
}

export function normalizeInstalledLanguagePacks(
  languages?: string[],
  preferredLanguage?: string,
): SupportedAppLanguage[] {
  const installed = new Set<SupportedAppLanguage>(BUNDLED_APP_LANGUAGE_PACKS.map((pack) => pack.value));

  languages?.forEach((language) => {
    if (isLanguagePackBundled(language) || isLanguagePackDownloadable(language)) {
      installed.add(language as SupportedAppLanguage);
    }
  });

  if (preferredLanguage && (isLanguagePackBundled(preferredLanguage) || isLanguagePackDownloadable(preferredLanguage))) {
    installed.add(preferredLanguage as SupportedAppLanguage);
  }

  return APP_LANGUAGE_PACKS
    .map((pack) => pack.value)
    .filter((language) => installed.has(language));
}

export function getSelectableAppLanguageOptions(installedLanguages: string[]) {
  const installed = new Set(normalizeInstalledLanguagePacks(installedLanguages));
  return APP_LANGUAGE_OPTIONS.filter((option) => installed.has(option.value));
}
