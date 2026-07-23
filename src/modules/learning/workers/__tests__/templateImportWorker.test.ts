import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFeaturedDeckTemplates } from '@/lib/learning';
import { buildFeaturedTemplateEntities } from '../templateImportWorker';

describe('template import worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves featured-template parsing and entity construction into a module worker', async () => {
    const entities = {
      decks: [],
      notes: [],
      cards: [],
    };
    const workers: TestWorker[] = [];

    class TestWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      readonly postMessage = vi.fn((request: { assetUrl: string }) => {
        expect(request.assetUrl).toMatch(/learn-templates\/arabic-top-5000\.json$/);
        queueMicrotask(() => this.onmessage?.({ data: { ok: true, entities } } as MessageEvent));
      });
      readonly terminate = vi.fn();

      constructor() {
        workers.push(this);
      }
    }

    vi.stubGlobal('Worker', TestWorker);

    await expect(buildFeaturedTemplateEntities(getFeaturedDeckTemplates()[0], 1_700_000_000_000)).resolves.toBe(entities);
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({
      importedAt: 1_700_000_000_000,
      deckMeta: {
        sourceTemplateId: 'arabic-top-5000',
        sourceType: 'template',
      },
    }));
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
});
