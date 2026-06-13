export type LearningMediaKind = 'image' | 'audio' | 'video' | 'document' | 'unknown';
export type LearningMediaState = 'draft' | 'pending' | 'ready' | 'synced' | 'failed';

export interface LearningMediaAsset {
  id: string;
  deckId?: string;
  noteId?: string;
  kind: LearningMediaKind;
  state: LearningMediaState;
  sourceUri?: string;
  remoteUrl?: string;
  checksum?: string;
  mimeType?: string;
  bytes?: number;
  lastError?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: number;
  updatedAt: number;
}

export interface LearningMediaRegistry {
  version: 1;
  updatedAt: number;
  assets: LearningMediaAsset[];
}

export interface LearningMediaAssetInput extends Partial<Omit<LearningMediaAsset, 'id' | 'createdAt' | 'updatedAt'>> {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Inline-Base64-Blobs (data:-URLs) dürfen nie in Registry/Transfer-Queue
 * dupliziert werden — der Blob lebt genau einmal in der Note; Registry und
 * Queue referenzieren ihn über diese URI (Masterplan 2.5).
 */
export const NOTE_MEDIA_URI_PREFIX = 'note-media://';

export function toNoteMediaRef(noteId: string): string {
  return `${NOTE_MEDIA_URI_PREFIX}${noteId}`;
}

export function isInlineDataUrl(value: string | undefined): boolean {
  return typeof value === 'string' && value.trimStart().toLowerCase().startsWith('data:');
}

let mediaAssetIdCounter = 0;

function nowTimestamp(value?: number) {
  return Number.isFinite(value) ? Math.round(value as number) : Date.now();
}

function createMediaAssetId() {
  mediaAssetIdCounter += 1;
  return `media-asset-${Date.now().toString(36)}-${mediaAssetIdCounter.toString(36)}`;
}

function normalizeKind(kind?: string): LearningMediaKind {
  if (kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'document') {
    return kind;
  }

  return 'unknown';
}

function normalizeState(state?: string): LearningMediaState {
  if (state === 'draft' || state === 'pending' || state === 'ready' || state === 'synced' || state === 'failed') {
    return state;
  }

  return 'draft';
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeMetadata(
  metadata: LearningMediaAssetInput['metadata'],
): LearningMediaAsset['metadata'] | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(([, value]) =>
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function normalizeMediaAsset(input: LearningMediaAssetInput): LearningMediaAsset {
  const id = normalizeString(input.id) || createMediaAssetId();
  const createdAt = nowTimestamp(input.createdAt);
  const updatedAt = Math.max(nowTimestamp(input.updatedAt), createdAt);
  const noteId = normalizeString(input.noteId);
  const rawSourceUri = normalizeString(input.sourceUri);
  const rawRemoteUrl = normalizeString(input.remoteUrl);
  // Heilt auch alte persistierte States, in denen der Blob bereits dupliziert wurde.
  const sourceUri = isInlineDataUrl(rawSourceUri) && noteId ? toNoteMediaRef(noteId) : rawSourceUri;
  const remoteUrl = isInlineDataUrl(rawRemoteUrl) ? undefined : rawRemoteUrl;

  return {
    id,
    deckId: normalizeString(input.deckId),
    noteId,
    kind: normalizeKind(input.kind),
    state: normalizeState(input.state),
    sourceUri,
    remoteUrl,
    checksum: normalizeString(input.checksum),
    mimeType: normalizeString(input.mimeType),
    bytes: Number.isFinite(input.bytes) ? Math.max(0, Math.round(input.bytes as number)) : undefined,
    lastError: normalizeString(input.lastError),
    metadata: normalizeMetadata(input.metadata),
    createdAt,
    updatedAt,
  };
}

function sortAssets(assets: LearningMediaAsset[]) {
  return [...assets].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.id.localeCompare(right.id);
  });
}

export function normalizeMediaRegistry(
  input?: Partial<LearningMediaRegistry> | null,
): LearningMediaRegistry {
  const mergedAssets = new Map<string, LearningMediaAsset>();

  for (const asset of input?.assets || []) {
    const normalized = normalizeMediaAsset(asset);
    const existing = mergedAssets.get(normalized.id);

    if (!existing) {
      mergedAssets.set(normalized.id, normalized);
      continue;
    }

    mergedAssets.set(normalized.id, {
      ...existing,
      ...normalized,
      createdAt: Math.min(existing.createdAt, normalized.createdAt),
      updatedAt: Math.max(existing.updatedAt, normalized.updatedAt),
    });
  }

  return {
    version: 1,
    updatedAt: Math.max(
      nowTimestamp(input?.updatedAt),
      ...Array.from(mergedAssets.values()).map((asset) => asset.updatedAt),
    ),
    assets: sortAssets(Array.from(mergedAssets.values())),
  };
}

export function createLearningMediaAsset(input: LearningMediaAssetInput): LearningMediaAsset {
  return normalizeMediaAsset(input);
}

export function upsertMediaAsset(
  registry: Partial<LearningMediaRegistry> | null | undefined,
  asset: LearningMediaAssetInput,
): LearningMediaRegistry {
  const normalizedRegistry = normalizeMediaRegistry(registry);
  const normalizedAsset = normalizeMediaAsset(asset);
  const existing = normalizedRegistry.assets.find((candidate) => candidate.id === normalizedAsset.id);

  const nextAssets = existing
    ? normalizedRegistry.assets.map((candidate) => (candidate.id === normalizedAsset.id
      ? {
          ...candidate,
          ...normalizedAsset,
          createdAt: Math.min(candidate.createdAt, normalizedAsset.createdAt),
          updatedAt: Math.max(candidate.updatedAt, normalizedAsset.updatedAt),
        }
      : candidate))
    : [...normalizedRegistry.assets, normalizedAsset];

  return normalizeMediaRegistry({
    ...normalizedRegistry,
    assets: nextAssets,
    updatedAt: Math.max(normalizedRegistry.updatedAt, normalizedAsset.updatedAt),
  });
}

export function upsertMediaAssets(
  registry: Partial<LearningMediaRegistry> | null | undefined,
  assets: LearningMediaAssetInput[],
): LearningMediaRegistry {
  return assets.reduce((nextRegistry, asset) => upsertMediaAsset(nextRegistry, asset), registry);
}

export function getMediaAssetById(
  registry: Partial<LearningMediaRegistry> | null | undefined,
  assetId: string,
): LearningMediaAsset | undefined {
  return normalizeMediaRegistry(registry).assets.find((asset) => asset.id === assetId);
}

export function getMediaAssetsForDeck(
  registry: Partial<LearningMediaRegistry> | null | undefined,
  deckId: string,
): LearningMediaAsset[] {
  return normalizeMediaRegistry(registry).assets.filter((asset) => asset.deckId === deckId);
}

export function getPendingMediaAssets(
  registry: Partial<LearningMediaRegistry> | null | undefined,
): LearningMediaAsset[] {
  return normalizeMediaRegistry(registry).assets.filter((asset) => asset.state === 'pending' || asset.state === 'draft');
}

export function getFailedMediaAssets(
  registry: Partial<LearningMediaRegistry> | null | undefined,
): LearningMediaAsset[] {
  return normalizeMediaRegistry(registry).assets.filter((asset) => asset.state === 'failed');
}

export function getMediaRegistrySignature(
  registry?: Partial<LearningMediaRegistry> | null,
): string {
  return JSON.stringify(normalizeMediaRegistry(registry));
}
