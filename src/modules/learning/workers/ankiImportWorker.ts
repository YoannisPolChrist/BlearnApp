import { parseAnkiPackage, type ParsedAnkiImport } from '@/lib/ankiImport';

interface AnkiImportWorkerResponse {
  ok: boolean;
  parsed?: ParsedAnkiImport;
  error?: string;
}

/**
 * Keeps APKG decompression, SQLite reads, media conversion, and template
 * rendering away from the interactive store update. Older WebViews and test
 * environments retain the established in-thread parser as a compatibility
 * fallback.
 */
export async function parseAnkiPackageInWorker(
  filename: string,
  content: ArrayBuffer,
): Promise<ParsedAnkiImport> {
  if (typeof Worker === 'undefined') {
    return parseAnkiPackage(filename, content);
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./ankiImport.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return parseAnkiPackage(filename, content);
  }

  return new Promise<ParsedAnkiImport>((resolve, reject) => {
    const finish = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<AnkiImportWorkerResponse>) => {
      finish();
      if (event.data.ok && event.data.parsed) {
        resolve(event.data.parsed);
      } else {
        reject(new Error(event.data.error || 'Anki import failed'));
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(event.error instanceof Error ? event.error : new Error(event.message || 'Anki import worker failed'));
    };
    worker.postMessage({ filename, content }, [content]);
  });
}
