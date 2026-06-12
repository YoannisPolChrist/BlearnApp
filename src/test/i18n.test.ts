import { describe, expect, it } from 'vitest';
import { ensureLanguagePackAvailable, translate } from '@/lib/i18n';
import { getSelectableAppLanguageOptions, normalizeInstalledLanguagePacks } from '@/lib/languages';

describe('i18n language packs', () => {
  it('keeps bundled languages available by default and preserves selected downloads', () => {
    expect(normalizeInstalledLanguagePacks()).toEqual(['de', 'en', 'fr']);
    expect(normalizeInstalledLanguagePacks(undefined, 'es')).toEqual(['de', 'en', 'fr', 'es']);
    expect(getSelectableAppLanguageOptions(['de', 'en', 'fr', 'it']).map((option) => option.value)).toEqual([
      'de',
      'en',
      'fr',
      'it',
    ]);
  });

  it('loads downloadable packs lazily and switches translations afterwards', async () => {
    expect(translate('es', 'nav.settings')).toBe('Settings');

    await ensureLanguagePackAvailable('es');

    expect(translate('es', 'nav.settings')).toBe('Ajustes');
  });
});
