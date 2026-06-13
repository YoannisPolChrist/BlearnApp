import { describe, expect, it } from 'vitest';
import {
  getFailedMediaAssets,
  getMediaAssetsForDeck,
  getMediaRegistrySignature,
  getPendingMediaAssets,
  normalizeMediaRegistry,
  upsertMediaAsset,
} from '../mediaRegistry';

describe('mediaRegistry', () => {
  it('normalizes, upserts and filters assets deterministically', () => {
    const registry = normalizeMediaRegistry({
      assets: [
        {
          id: 'asset-1',
          deckId: 'deck-a',
          kind: 'image',
          state: 'pending',
          createdAt: 10,
          updatedAt: 10,
        },
      ],
    });

    const nextRegistry = upsertMediaAsset(registry, {
      id: 'asset-1',
      deckId: 'deck-a',
      kind: 'image',
      state: 'synced',
      remoteUrl: 'https://example.com/asset.png',
      createdAt: 10,
      updatedAt: 25,
    });

    expect(getMediaAssetsForDeck(nextRegistry, 'deck-a')).toHaveLength(1);
    expect(getPendingMediaAssets(nextRegistry)).toHaveLength(0);
    expect(getFailedMediaAssets(nextRegistry)).toHaveLength(0);
    expect(getMediaRegistrySignature(nextRegistry)).toContain('asset-1');
    expect(nextRegistry.assets[0].state).toBe('synced');
    expect(nextRegistry.assets[0].remoteUrl).toBe('https://example.com/asset.png');
  });

  it('ersetzt Base64-data:-URLs durch note-media-Referenzen (kein Blob im Registry-State)', () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(2048)}`;
    const registry = upsertMediaAsset(undefined, {
      id: 'asset-blob',
      noteId: 'note-7',
      kind: 'image',
      state: 'pending',
      sourceUri: dataUrl,
      remoteUrl: dataUrl,
      createdAt: 10,
      updatedAt: 10,
    });

    expect(registry.assets[0].sourceUri).toBe('note-media://note-7');
    expect(registry.assets[0].remoteUrl).toBeUndefined();
    expect(getMediaRegistrySignature(registry)).not.toContain('base64');
  });
});
