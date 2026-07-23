import { parseAnkiPackage } from '@/lib/ankiImport';

interface AnkiImportWorkerRequest {
  filename: string;
  content: ArrayBuffer;
}

self.onmessage = async (event: MessageEvent<AnkiImportWorkerRequest>) => {
  try {
    const parsed = await parseAnkiPackage(event.data.filename, event.data.content);
    self.postMessage({ ok: true, parsed });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
