import { buildEntitiesFromRows, normalizeImportPayload } from '../import/buildEntities';
import type { ImportPayload, ImportableRow, LearningDeck } from '../domain/entities';

interface TemplateImportWorkerRequest {
  assetUrl: string;
  importedAt: number;
  deckMeta: Pick<LearningDeck, 'sourceTemplateId' | 'sourceType'>;
}

self.onmessage = async (event: MessageEvent<TemplateImportWorkerRequest>) => {
  try {
    const response = await fetch(event.data.assetUrl);
    if (!response.ok) {
      throw new Error(`Template download failed: ${response.status}`);
    }

    const payload = (await response.json()) as ImportPayload | ImportableRow[];
    const rows = normalizeImportPayload(payload);
    const entities = buildEntitiesFromRows(rows, event.data.importedAt, event.data.deckMeta);
    self.postMessage({ ok: true, entities });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
