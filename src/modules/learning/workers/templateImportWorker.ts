import { buildEntitiesFromRows } from '../import/buildEntities';
import { loadFeaturedDeckTemplateRows, resolveStaticAssetUrl } from '../import/templates';
import type { FeaturedDeckTemplate, LearningDeck } from '../domain/entities';
import type { ImportedEntities } from '../store/helpers';

interface TemplateImportWorkerResponse {
  ok: boolean;
  entities?: ImportedEntities;
  error?: string;
}

function buildTemplateEntitiesOnMainThread(
  template: FeaturedDeckTemplate,
  importedAt: number,
): Promise<ImportedEntities> {
  return loadFeaturedDeckTemplateRows(template.id).then((rows) =>
    buildEntitiesFromRows(rows, importedAt, {
      sourceTemplateId: template.id,
      sourceType: 'template',
    }),
  );
}

/**
 * Parses and materializes large bundled templates outside the UI thread.
 * The fallback preserves imports in test runners and older WebViews that do
 * not support module workers.
 */
export async function buildFeaturedTemplateEntities(
  template: FeaturedDeckTemplate,
  importedAt: number,
): Promise<ImportedEntities> {
  if (typeof Worker === 'undefined') {
    return buildTemplateEntitiesOnMainThread(template, importedAt);
  }

  const deckMeta: Pick<LearningDeck, 'sourceTemplateId' | 'sourceType'> = {
    sourceTemplateId: template.id,
    sourceType: 'template',
  };

  let worker: Worker;
  try {
    worker = new Worker(new URL('./templateImport.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return buildTemplateEntitiesOnMainThread(template, importedAt);
  }

  return new Promise<ImportedEntities>((resolve, reject) => {
    const finish = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<TemplateImportWorkerResponse>) => {
      finish();
      if (event.data.ok && event.data.entities) {
        resolve(event.data.entities);
      } else {
        reject(new Error(event.data.error || 'Template import failed'));
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(event.error instanceof Error ? event.error : new Error(event.message || 'Template import worker failed'));
    };
    worker.postMessage({
      assetUrl: resolveStaticAssetUrl(template.assetPath),
      importedAt,
      deckMeta,
    });
  });
}
