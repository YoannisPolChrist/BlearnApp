
import type { FeaturedDeckTemplate, ImportPayload, ImportableRow, LearningDeck } from '../domain/entities';
import { normalizeImportPayload } from './buildEntities';

const FEATURED_DECK_TEMPLATES: FeaturedDeckTemplate[] = [
  {
    id: 'arabic-top-5000',
    title: 'Arabic Top 5000',
    description: 'Frequenzsortierter Kernwortschatz für modernes Arabisch mit RTL-freundlichem Deck.',
    language: 'ar',
    cardCount: 5281,
    deckNames: ['Arabic Top 5000'],
    assetPath: 'learn-templates/arabic-top-5000.json',
    category: 'Frequenzliste',
    highlights: ['5.281 Karten', 'RTL-Deck', 'Top-5000 Reihenfolge'],
    accent: 'arabic',
    rtl: true,
  },
  {
    id: 'spanish-top-5000',
    title: 'Spanish Top 5000',
    description: 'Alltagsnaher Spanisch-Wortschatz für Reise, Medien und tägliche Konversation.',
    language: 'es',
    cardCount: 5000,
    deckNames: ['Spanish Top 5000'],
    assetPath: 'learn-templates/spanish-top-5000.json',
    category: 'Alltag + Reise',
    highlights: ['5.000 Karten', 'hohe Abdeckung', 'schneller Reise-Start'],
    accent: 'spanish',
  },
  {
    id: 'italian-top-5000',
    title: 'Italian Top 5000',
    description: 'Häufigste italienische Wörter für Lesen, Reisen und natürliche Gespräche.',
    language: 'it',
    cardCount: 4998,
    deckNames: ['Italian Top 5000'],
    assetPath: 'learn-templates/italian-top-5000.json',
    category: 'Lesen + Gespräch',
    highlights: ['4.998 Karten', 'häufige Begriffe', 'kompakter Import'],
    accent: 'italian',
  },
  {
    id: 'french-top-5000',
    title: 'French Top 5000',
    description: 'Französisch-Deutsch Kernvokabeln aus einer grammatiknahen 5000er-Quelle.',
    language: 'fr',
    cardCount: 5000,
    deckNames: ['French Top 5000'],
    assetPath: 'learn-templates/french-top-5000.json',
    category: 'Wortschatz + Grammatik',
    highlights: ['5.000 Karten', 'DE Bedeutungen', 'leichtes Standard-Deck'],
    accent: 'french',
  },
  {
    id: 'jean-paul',
    title: 'Jean Paul 2.0',
    description: 'Aktueller Jean-Paul-Stand aus der neuen APKG inklusive echter Review-Timestamps.',
    language: 'fr',
    cardCount: 3251,
    deckNames: ['Jean Paul', 'Jean-Paul'],
    assetPath: 'learn-templates/jean-paul.json',
    category: 'Persoenliches Deck',
    highlights: ['3.251 Karten', 'Jean Paul 2.0', 'Review-Historie enthalten'],
    accent: 'french',
    replaceExistingOnImport: true,
  },
  {
    id: 'jean-paul-spanish',
    title: 'Jean Paul Spanisch',
    description: 'Deutsch-Spanisch Starterdeck mit frischem Lernstand und ohne alte Review-Historie.',
    language: 'es',
    cardCount: 3251,
    deckNames: ['Jean Paul Spanisch', 'Jean-Paul Spanisch'],
    assetPath: 'learn-templates/jean-paul-spanish.json',
    category: 'Persoenliches Deck',
    highlights: ['3.251 Karten', 'Spanisch fuer den Einstieg', 'Frischer Lernstand'],
    accent: 'spanish',
  },
];

const featuredDeckTemplateRowsCache = new Map<string, Promise<ImportableRow[]>>();

export function getStarterDeckRows(): ImportableRow[] {
  return [
    {
      deck: 'Starter Vokabeln',
      front: 'house',
      back: 'Haus',
      type: 'basic',
      tags: ['starter', 'english'],
      language: 'de',
    },
    {
      deck: 'Starter Vokabeln',
      front: 'apple',
      back: 'Apfel',
      type: 'basic',
      tags: ['starter', 'english'],
      language: 'de',
    },
    {
      deck: 'Starter Vokabeln',
      front: 'I am {{c1::learning}} every day.',
      back: 'learning',
      type: 'cloze',
      tags: ['starter', 'cloze'],
      language: 'en',
      clozeText: 'I am {{c1::learning}} every day.',
      expectedAnswer: 'learning',
    },
    {
      deck: 'Starter Vokabeln',
      front: 'book',
      back: 'Buch',
      type: 'basic',
      tags: ['starter', 'english'],
      language: 'de',
    },
    {
      deck: 'Starter Vokabeln',
      front: 'friend',
      back: 'Freund',
      type: 'basic',
      tags: ['starter', 'english'],
      language: 'de',
    },
  ];
}

export function getFeaturedDeckTemplates(): FeaturedDeckTemplate[] {
  return FEATURED_DECK_TEMPLATES;
}

function resolveStaticAssetUrl(assetPath: string): string {
  let baseUrl = import.meta.env.BASE_URL || '/';
  if (baseUrl === './') baseUrl = '/';
  else if (baseUrl.startsWith('./')) baseUrl = baseUrl.substring(1);
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}${assetPath.replace(/^\/+/, '')}`;
}

export function isFeaturedDeckTemplateImported(
  template: FeaturedDeckTemplate,
  importedDeckNamesOrDecks: Set<string> | LearningDeck[],
): boolean {
  if (Array.isArray(importedDeckNamesOrDecks)) {
    return importedDeckNamesOrDecks.some((deck) =>
      deck.sourceTemplateId === template.id
      || template.deckNames.some((deckName) => deck.name.trim().toLowerCase() === deckName.trim().toLowerCase()),
    );
  }

  return template.deckNames.some((deckName) => importedDeckNamesOrDecks.has(deckName.trim().toLowerCase()));
}

export async function loadFeaturedDeckTemplateRows(templateId: string): Promise<ImportableRow[]> {
  const template = FEATURED_DECK_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`Unknown featured template: ${templateId}`);
  }

  const cachedRows = featuredDeckTemplateRowsCache.get(templateId);
  if (cachedRows) {
    return cachedRows;
  }

  const nextRows = fetch(`${resolveStaticAssetUrl(template.assetPath)}?t=${Date.now()}`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Template download failed: ${response.status}`);
      }

      const payload = (await response.json()) as ImportPayload | ImportableRow[];
      return normalizeImportPayload(payload);
    })
    .catch((error) => {
      featuredDeckTemplateRowsCache.delete(templateId);
      throw error;
    });

  featuredDeckTemplateRowsCache.set(templateId, nextRows);
  return nextRows;
}
