import { strFromU8, unzipSync } from 'fflate';
import { decompress } from 'fzstd';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import {
  type AnkiReviewMetadata,
  extractClozeAnswer,
  renderClozeValue,
  type CardTemplateType,
  type ImportableRow,
  type LearningCardState,
  type ReviewLog,
  type ReviewRating,
} from '@/lib/learning';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INLINE_MEDIA_BYTES = 1_500_000;
const MAX_INLINE_ASSET_BYTES = 350_000;
const BASE64_CHUNK_SIZE = 0x8000;
const SQLITE_HEADER = 'SQLite format 3';
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

interface ParsedAnkiImport {
  rows: ImportableRow[];
  reviewLogs: Array<Omit<ReviewLog, 'id' | 'deckId' | 'cardId'> & {
    sourceCardId: string;
    anki?: AnkiReviewMetadata;
  }>;
}

interface AnkiDeckRecord {
  name?: string;
  desc?: string;
}

interface AnkiModelField {
  name?: string;
}

interface AnkiTemplateRecord {
  name?: string;
  qfmt?: string;
  afmt?: string;
}

interface AnkiModelRecord {
  name?: string;
  type?: number;
  css?: string;
  flds?: AnkiModelField[];
  tmpls?: AnkiTemplateRecord[];
}

interface AnkiRevlogRow {
  reviewId: number;
  cardId: number;
  ease?: number;
  ivl?: number;
  lastIvl?: number;
  factor?: number;
  time?: number;
  reviewType?: number;
  usn?: number;
}

interface JoinedAnkiRow {
  cardId: number;
  noteId: number;
  deckId: number;
  cardOrd: number;
  cardType: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  leftCount: number;
  cardMod: number;
  modelId: number;
  tags: string;
  fields: string;
  sortField: string;
  noteMod: number;
}

let sqlPromise: Promise<SqlJsStatic> | null = null;

function normalizeFileUrlPath(pathname: string): string {
  const decodedPath = decodeURIComponent(pathname);
  return /^\/[a-zA-Z]:\//.test(decodedPath) ? decodedPath.slice(1) : decodedPath;
}

function resolveSqlWasmPath(): string {
  const sqlWasmAssetUrl = new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url);

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  if (isTestEnv) {
    return process.cwd() + '/node_modules/sql.js/dist/sql-wasm.wasm';
  }

  if (typeof window === 'undefined') {
    return normalizeFileUrlPath(sqlWasmAssetUrl.pathname);
  }

  return sqlWasmAssetUrl.href;
}

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => resolveSqlWasmPath(),
    });
  }

  return sqlPromise;
}

function decodeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getExecRows<T extends Record<string, unknown>>(database: InstanceType<SqlJsStatic['Database']>, sql: string): T[] {
  const [result] = database.exec(sql);
  if (!result) return [];

  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])) as T,
  );
}

function getTableColumnNames(
  database: InstanceType<SqlJsStatic['Database']>,
  tableName: string,
): string[] {
  return getExecRows<{ name: string }>(database, `PRAGMA table_info(${tableName})`)
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

function toMilliseconds(value: number | undefined | null): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (!value) return undefined;
  if (value > 1e12) return value;
  if (value > 1e9) return value * 1000;
  return undefined;
}

function decodeHtmlEntities(value: string): string {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToPlainText(value: string): string {
  const normalized = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|section|article|tr|h[1-6])>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/<img[^>]*>/gi, '');

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(normalized, 'text/html');
    return decodeHtmlEntities(documentNode.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  return decodeHtmlEntities(normalized.replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeFilename(value: string): string {
  return decodeHtmlEntities(value).trim().replace(/^\.?[\\/]+/, '');
}

function getFileExtension(value: string): string {
  const normalized = normalizeFilename(value);
  const extension = normalized.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE);
    let segment = '';
    for (let ci = 0; ci < chunk.length; ci += 1) {
      segment += String.fromCharCode(chunk[ci]);
    }
    parts.push(segment);
  }

  return btoa(parts.join(''));
}

function toDataUrl(filename: string, bytes: Uint8Array): string {
  const mimeType = getMimeType(filename);
  const base64 = encodeBase64Bytes(bytes);
  return `data:${mimeType};base64,${base64}`;
}

function getMimeType(filename: string): string {
  switch (getFileExtension(filename)) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
    default:
      return 'image/png';
  }
}

function getMediaManifest(entries: Record<string, Uint8Array>): Record<string, string> {
  const mediaEntry = entries.media;
  if (!mediaEntry) return {};
  return decodeJson<Record<string, string>>(strFromU8(mediaEntry), {});
}

function getCollectionBytes(entries: Record<string, Uint8Array>): Uint8Array {
  const directCandidates = ['collection.anki21', 'collection.anki2', 'collection.sqlite'];
  const compressedCandidate = entries['collection.anki21b'];

  if (compressedCandidate) {
    return decompress(compressedCandidate);
  }

  for (const candidate of directCandidates) {
    const entry = entries[candidate];
    if (!entry) continue;
    if (strFromU8(entry.subarray(0, SQLITE_HEADER.length)) === SQLITE_HEADER) {
      return entry;
    }
  }

  throw new Error('Keine kompatible Anki-Datenbank im Paket gefunden.');
}

function mapAnkiCardState(cardType: number, queue: number): LearningCardState {
  if (queue === 2 || cardType === 2) return 'review';
  if (queue === 1 || queue === 3 || cardType === 1) return 'learning';
  if (cardType === 3) return 'relearning';
  return 'new';
}

function mapAnkiEaseToRating(ease?: number): ReviewRating {
  switch (ease) {
    case 1:
      return 'again';
    case 2:
      return 'hard';
    case 4:
      return 'easy';
    default:
      return 'good';
  }
}

function mapAnkiReviewTypeToState(reviewType?: number): LearningCardState {
  switch (reviewType) {
    case 1:
      return 'review';
    case 2:
      return 'relearning';
    case 0:
      return 'learning';
    default:
      return 'review';
  }
}

function mapAnkiReviewNextState(reviewType: number | undefined, ease: number | undefined): LearningCardState {
  if (ease === 1) {
    return reviewType === 1 ? 'relearning' : 'learning';
  }

  return mapAnkiReviewTypeToState(reviewType);
}

function mapAnkiDueAt(card: JoinedAnkiRow, collectionCreatedAt: number, state: LearningCardState, now: number): number {
  const directDue = toMilliseconds(card.due);
  if (directDue) {
    return directDue;
  }

  if (state === 'review') {
    if (card.due > 0 && card.due < 100_000) {
      return collectionCreatedAt + card.due * DAY_MS;
    }

    return now + Math.max(1, Math.round(card.ivl || 0)) * DAY_MS;
  }

  if ((state === 'learning' || state === 'relearning') && card.queue === 3 && card.due > 0) {
    return collectionCreatedAt + card.due * DAY_MS;
  }

  return now;
}

function getTemplateType(model: AnkiModelRecord | undefined, fieldValues: string[]): CardTemplateType {
  if (model?.type === 1) return 'cloze';
  return fieldValues.some((field) => /\{\{c\d+::/i.test(field)) ? 'cloze' : 'basic';
}

function getFieldMap(model: AnkiModelRecord | undefined, fieldValues: string[], tags: string): Record<string, string> {
  const fieldMap: Record<string, string> = {
    Tags: tags,
  };
  const fieldNames = model?.flds?.map((field, index) => field.name || `Field ${index + 1}`) || [];

  fieldValues.forEach((value, index) => {
    const fieldName = fieldNames[index] || `Field ${index + 1}`;
    fieldMap[fieldName] = value;
  });

  return fieldMap;
}

function getSubdeckName(deckName: string) {
  const parts = deckName.split('::').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || deckName;
}

function createHintHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return `<details class="anki-hint"><summary>show hint</summary><div class="anki-hint-content">${trimmed}</div></details>`;
}

function renderRubyText(value: string, mode: 'furigana' | 'kana' | 'kanji') {
  return value.replace(/ ?([^ <>[\]]+)\[([^\]]+)\]/g, (_match, base, ruby) => {
    if (mode === 'kana') {
      return ruby;
    }
    if (mode === 'kanji') {
      return base;
    }

    return `<ruby>${base}<rt>${ruby}</rt></ruby>`;
  });
}

function applyConditionals(template: string, fieldMap: Record<string, string>): string {
  let next = template;

  for (let pass = 0; pass < 8; pass += 1) {
    const resolved = next
      .replace(/\{\{#([^}:]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) =>
        fieldMap[key]?.trim() ? content : '',
      )
      .replace(/\{\{\^([^}:]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) =>
        fieldMap[key]?.trim() ? '' : content,
      );

    if (resolved === next) {
      return resolved;
    }

    next = resolved;
  }

  return next;
}

function renderTemplate(
  template: string,
  fieldMap: Record<string, string>,
  options?: { frontSide?: string; clozeNumber?: number; mode?: 'front' | 'back' },
): string {
  const conditioned = applyConditionals(template, fieldMap);

  return conditioned
    .replace(/\{\{FrontSide\}\}/g, options?.frontSide || '')
    .replace(/\{\{([^}]+)\}\}/g, (_match, rawExpression) => {
      const expression = rawExpression.trim();
      if (!expression) {
        return '';
      }

      const segments = expression.split(':').map((part) => part.trim()).filter(Boolean);
      const fieldName = segments.pop() || '';
      let resolved = fieldMap[fieldName] || '';

      if (expression === 'FrontSide') {
        return options?.frontSide || '';
      }

      if (segments.length === 0) {
        return resolved;
      }

      for (const filterName of segments) {
        switch (filterName.toLowerCase()) {
          case 'cloze':
            resolved = renderClozeValue(resolved, options?.clozeNumber || 1, options?.mode || 'front');
            break;
          case 'text':
            resolved = htmlToPlainText(resolved);
            break;
          case 'type':
            resolved = (options?.mode || 'front') === 'front'
              ? '<span class="typePrompt">........</span>'
              : `<span class="typeAnswer">${htmlToPlainText(resolved)}</span>`;
            break;
          case 'hint':
            resolved = createHintHtml(resolved);
            break;
          case 'furigana':
            resolved = renderRubyText(resolved, 'furigana');
            break;
          case 'kana':
            resolved = renderRubyText(resolved, 'kana');
            break;
          case 'kanji':
            resolved = renderRubyText(resolved, 'kanji');
            break;
          default:
            resolved = resolved || fieldMap[`${filterName}:${fieldName}`] || '';
            break;
        }
      }

      return resolved;
    });
}

function inlineMediaAssets(
  value: string,
  mediaFiles: Map<string, Uint8Array>,
  budget: { usedBytes: number },
): string {
  return value
    .replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, beforeSrc, rawSrc, afterSrc) => {
      const filename = normalizeFilename(rawSrc);
      const extension = getFileExtension(filename);
      if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
        return match;
      }

      const bytes = mediaFiles.get(filename);
      if (!bytes) {
        return match;
      }
      if (bytes.byteLength > MAX_INLINE_ASSET_BYTES) {
        return match;
      }
      if (budget.usedBytes + bytes.byteLength > MAX_INLINE_MEDIA_BYTES) {
        return match;
      }

      budget.usedBytes += bytes.byteLength;
      return `<img${beforeSrc}src="${toDataUrl(filename, bytes)}"${afterSrc}>`;
    })
    .replace(/\[sound:([^\]]+)\]/gi, (_match, rawFilename) => {
      const filename = normalizeFilename(rawFilename);
      return `<span class="anki-sound" data-filename="${escapeHtmlAttribute(filename)}">[Audio: ${filename}]</span>`;
    });
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildRenderedFields(
  row: JoinedAnkiRow,
  model: AnkiModelRecord | undefined,
  fieldValues: string[],
  fieldMap: Record<string, string>,
  mediaFiles: Map<string, Uint8Array>,
  budget: { usedBytes: number },
): {
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  clozeText?: string;
  expectedAnswer?: string;
  templateCss?: string;
  templateCardClass?: string;
} {
  const templateType = getTemplateType(model, fieldValues);
  const templateCss = model?.css || undefined;
  const templateCardClass = `card card${row.cardOrd + 1}`;

  if (templateType === 'cloze') {
    const clozeNumber = row.cardOrd + 1;
    const clozeField = fieldValues.find((value) => /\{\{c\d+::/i.test(value)) || fieldValues[0] || '';
    const extraFields = fieldValues.filter((value) => value !== clozeField).filter(Boolean);
    const frontHtml = inlineMediaAssets(renderClozeValue(clozeField, clozeNumber, 'front'), mediaFiles, budget);
    const backHtml = inlineMediaAssets(
      [renderClozeValue(clozeField, clozeNumber, 'back'), ...extraFields].filter(Boolean).join('<br><br>'),
      mediaFiles,
      budget,
    );

    return {
      front: htmlToPlainText(frontHtml),
      back: htmlToPlainText(backHtml),
      frontHtml,
      backHtml,
      clozeText: clozeField,
      expectedAnswer: htmlToPlainText(extractClozeAnswer(clozeField, clozeNumber)) || htmlToPlainText(backHtml),
      templateCss,
      templateCardClass,
    };
  }

  const template = model?.tmpls?.[row.cardOrd] || model?.tmpls?.[0];
  if (template?.qfmt || template?.afmt) {
    const renderedFront = inlineMediaAssets(renderTemplate(template.qfmt || '', fieldMap, { mode: 'front' }), mediaFiles, budget);
    const renderedBack = inlineMediaAssets(renderTemplate(template.afmt || '', fieldMap, {
      frontSide: renderedFront,
      mode: 'back',
    }), mediaFiles, budget);

    return {
      front: htmlToPlainText(renderedFront),
      back: htmlToPlainText(renderedBack),
      frontHtml: renderedFront,
      backHtml: renderedBack,
      templateCss,
      templateCardClass,
    };
  }

  const [frontField, ...backFields] = fieldValues;
  const frontHtml = inlineMediaAssets(frontField || row.sortField || '', mediaFiles, budget);
  const backHtml = inlineMediaAssets(backFields.filter(Boolean).join('<br><br>'), mediaFiles, budget);
  return {
    front: htmlToPlainText(frontHtml),
    back: htmlToPlainText(backHtml),
    frontHtml,
    backHtml,
    templateCss,
    templateCardClass,
  };
}

function takeInlineImage(
  value: string,
  mediaFiles: Map<string, Uint8Array>,
  budget: { usedBytes: number },
): string | undefined {
  const imageMatch = value.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!imageMatch) return undefined;

  const filename = normalizeFilename(imageMatch[1]);
  const extension = getFileExtension(filename);
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return undefined;
  }

  const bytes = mediaFiles.get(filename);
  if (!bytes) return undefined;
  if (bytes.byteLength > MAX_INLINE_ASSET_BYTES) return undefined;
  if (budget.usedBytes + bytes.byteLength > MAX_INLINE_MEDIA_BYTES) return undefined;

  budget.usedBytes += bytes.byteLength;
  return toDataUrl(filename, bytes);
}

function parseTags(value: string): string[] {
  return value
    .split(' ')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getCollectionCreatedAt(rawValue: number): number {
  if (rawValue > 1e12) return rawValue;
  if (rawValue > 1e9) return rawValue * 1000;
  return Date.now();
}

function guessLanguage(deckName: string, fieldValues: string[]): string {
  const combined = `${deckName} ${fieldValues.join(' ')}`.toLowerCase();
  if (/[ء-ي]/.test(combined)) return 'ar';
  if (/\b(francais|franz|french)\b/.test(combined)) return 'fr';
  if (/\b(spanish|espanol|spanisch)\b/.test(combined)) return 'es';
  if (/\b(italian|italiano|italien)\b/.test(combined)) return 'it';
  if (/\b(english|englisch)\b/.test(combined)) return 'en';
  return 'de';
}

function loadAnkiReviewRows(database: InstanceType<SqlJsStatic['Database']>): AnkiRevlogRow[] {
  const columns = new Set(getTableColumnNames(database, 'revlog'));
  if (!columns.has('id') || !columns.has('cid')) {
    return [];
  }

  const optionalColumns: Array<[column: string, alias: string]> = [
    ['ease', 'ease'],
    ['ivl', 'ivl'],
    ['lastIvl', 'lastIvl'],
    ['factor', 'factor'],
    ['time', 'time'],
    ['type', 'reviewType'],
    ['usn', 'usn'],
  ];

  const selectColumns = [
    'id AS reviewId',
    'cid AS cardId',
    ...optionalColumns
      .filter(([column]) => columns.has(column))
      .map(([column, alias]) => `${column} AS ${alias}`),
  ];

  return getExecRows<AnkiRevlogRow>(
    database,
    `SELECT ${selectColumns.join(', ')} FROM revlog ORDER BY id ASC`,
  );
}

export async function parseAnkiPackage(filename: string, arrayBuffer: ArrayBuffer): Promise<ParsedAnkiImport> {
  const supported = filename.toLowerCase().endsWith('.apkg') || filename.toLowerCase().endsWith('.colpkg');
  if (!supported) {
    throw new Error('Nur .apkg und .colpkg werden unterstützt.');
  }

  const zipEntries = unzipSync(new Uint8Array(arrayBuffer));
  const mediaManifest = getMediaManifest(zipEntries);
  const mediaFiles = new Map<string, Uint8Array>();
  Object.entries(mediaManifest).forEach(([zipEntryName, originalFilename]) => {
    const bytes = zipEntries[zipEntryName];
    if (bytes) {
      mediaFiles.set(normalizeFilename(originalFilename), bytes);
    }
  });

  const databaseBytes = getCollectionBytes(zipEntries);
  const SQL = await getSqlJs();
  const database = new SQL.Database(databaseBytes);

  try {
    const [collection] = getExecRows<{ decks: string; models: string; crt: number }>(
      database,
      'SELECT decks, models, crt FROM col LIMIT 1',
    );
    if (!collection) {
      throw new Error('Anki-Sammlung konnte nicht gelesen werden.');
    }

    const decksById = decodeJson<Record<string, AnkiDeckRecord>>(collection.decks, {});
    const modelsById = decodeJson<Record<string, AnkiModelRecord>>(collection.models, {});
    const reviewRows = loadAnkiReviewRows(database);
    const reviewTimes = new Map<number, number>();
    reviewRows.forEach((entry) => {
      const existingValue = reviewTimes.get(entry.cardId);
      if (!existingValue || entry.reviewId > existingValue) {
        reviewTimes.set(entry.cardId, entry.reviewId);
      }
    });
    if (reviewTimes.size === 0) {
      getExecRows<{ cardId: number; lastReviewId: number }>(
        database,
        'SELECT cid AS cardId, MAX(id) AS lastReviewId FROM revlog GROUP BY cid',
      ).forEach((entry) => {
        reviewTimes.set(entry.cardId, entry.lastReviewId);
      });
    }

    const joinedRows = getExecRows<JoinedAnkiRow>(
      database,
      [
        'SELECT',
        'c.id AS cardId,',
        'c.nid AS noteId,',
        'c.did AS deckId,',
        'c.ord AS cardOrd,',
        'c.type AS cardType,',
        'c.queue AS queue,',
        'c.due AS due,',
        'c.ivl AS ivl,',
        'c.factor AS factor,',
        'c.reps AS reps,',
        'c.lapses AS lapses,',
        'c.left AS leftCount,',
        'c.mod AS cardMod,',
        'n.mid AS modelId,',
        'n.tags AS tags,',
        'n.flds AS fields,',
        'n.sfld AS sortField,',
        'n.mod AS noteMod',
        'FROM cards c',
        'JOIN notes n ON n.id = c.nid',
        'ORDER BY c.did, c.nid, c.ord',
      ].join(' '),
    );

    const budget = { usedBytes: 0 };
    const collectionCreatedAt = getCollectionCreatedAt(collection.crt);
    const now = Date.now();
    const rows = joinedRows.map((row) => {
      const deckRecord = decksById[String(row.deckId)] || {};
      const model = modelsById[String(row.modelId)];
      const fieldValues = String(row.fields || '').split('\u001f');
      const fieldNames = model?.flds?.map((field, index) => field.name || `Field ${index + 1}`) || [];
      const tagList = parseTags(row.tags || '');
      const fieldMap = getFieldMap(model, fieldValues, tagList.join(' '));
      const template = model?.tmpls?.[row.cardOrd] || model?.tmpls?.[0];
      fieldMap.Type = model?.name || '';
      fieldMap.Deck = deckRecord.name?.trim() || 'Anki Import';
      fieldMap.Subdeck = getSubdeckName(fieldMap.Deck);
      fieldMap.Card = template?.name || `Card ${row.cardOrd + 1}`;
      fieldMap.CardFlag = '';
      const rendered = buildRenderedFields(row, model, fieldValues, fieldMap, mediaFiles, budget);
      const state = mapAnkiCardState(row.cardType, row.queue);
      const dueAt = mapAnkiDueAt(row, collectionCreatedAt, state, now);
      const lastReviewedAt =
        toMilliseconds(reviewTimes.get(row.cardId)) ||
        toMilliseconds(row.cardMod) ||
        toMilliseconds(row.noteMod);

      return {
        deck: deckRecord.name?.trim() || 'Anki Import',
        deckDescription: htmlToPlainText(deckRecord.desc || '') || `Importiert aus ${filename}`,
        front: rendered.front || htmlToPlainText(fieldValues[0] || ''),
        back: rendered.back || htmlToPlainText(fieldValues.slice(1).join('\n\n')),
        frontHtml: rendered.frontHtml,
        backHtml: rendered.backHtml,
        type: getTemplateType(model, fieldValues),
        tags: tagList,
        language: guessLanguage(deckRecord.name || '', fieldValues),
        clozeText: rendered.clozeText,
        expectedAnswer: rendered.expectedAnswer || rendered.back,
        mediaUrl: takeInlineImage(rendered.frontHtml || rendered.backHtml || fieldValues.join('\n'), mediaFiles, budget),
        templateCss: rendered.templateCss,
        templateCardClass: rendered.templateCardClass,
        anki: {
          deck: {
            deckId: String(row.deckId),
            originalName: deckRecord.name?.trim() || 'Anki Import',
            descriptionHtml: deckRecord.desc || undefined,
            descriptionText: htmlToPlainText(deckRecord.desc || '') || undefined,
            collectionCreatedAt,
          },
          note: {
            noteId: String(row.noteId),
            modelId: String(row.modelId),
            modelName: model?.name || undefined,
            sortField: row.sortField || undefined,
            tags: tagList,
            fields: fieldValues.map((value, index) => ({
              name: fieldNames[index] || `Field ${index + 1}`,
              value,
            })),
            noteModifiedAt: toMilliseconds(row.noteMod),
          },
          card: {
            cardId: String(row.cardId),
            noteId: String(row.noteId),
            deckId: String(row.deckId),
            templateOrdinal: row.cardOrd,
            templateName: template?.name || undefined,
            queue: row.queue,
            cardType: row.cardType,
            due: row.due,
            interval: row.ivl,
            factor: row.factor,
            reps: row.reps,
            lapses: row.lapses,
            leftCount: row.leftCount,
            cardModifiedAt: toMilliseconds(row.cardMod),
            lastReviewAt: lastReviewedAt,
          },
        },
        card: {
          state,
          dueAt,
          intervalDays: Math.max(0, Math.round(row.ivl || 0)),
          easeFactor: row.factor > 0 ? row.factor / 1000 : 2.5,
          reps: Math.max(0, Math.round(row.reps || 0)),
          lapses: Math.max(0, Math.round(row.lapses || 0)),
          stepIndex: 0,
          scheduledDays: Math.max(0, Math.round(row.ivl || 0)),
          elapsedDays:
            lastReviewedAt && dueAt > lastReviewedAt
              ? Math.max(0, Math.round((Math.min(now, dueAt) - lastReviewedAt) / DAY_MS))
              : 0,
          lastReviewedAt,
          createdAt: toMilliseconds(row.cardId) || now,
          updatedAt: lastReviewedAt || toMilliseconds(row.cardMod) || toMilliseconds(row.noteMod) || now,
        },
      } satisfies ImportableRow;
    }).filter((row) => row.front || row.clozeText || row.back);

    const reviewLogs = reviewRows.map((row) => {
      const reviewedAt = toMilliseconds(row.reviewId) || now;
      const previousState = mapAnkiReviewTypeToState(row.reviewType);
      return {
        sourceCardId: String(row.cardId),
        reviewedAt,
        rating: mapAnkiEaseToRating(row.ease),
        previousState,
        newState: mapAnkiReviewNextState(row.reviewType, row.ease),
        scheduledDays: Math.max(0, Math.round(row.ivl || 0)),
        elapsedDays: Math.max(0, Math.round(row.lastIvl || 0)),
        wasCorrect: (row.ease ?? 0) > 1,
        memoryStateBefore: null,
        memoryStateAfter: null,
        anki: {
          reviewId: String(row.reviewId),
          sourceCardId: String(row.cardId),
          ease: row.ease,
          interval: row.ivl,
          lastInterval: row.lastIvl,
          factor: row.factor,
          timeMs: row.time,
          reviewType: row.reviewType,
          usn: row.usn,
        },
      } satisfies Omit<ReviewLog, 'id' | 'deckId' | 'cardId'> & {
        sourceCardId: string;
        anki?: AnkiReviewMetadata;
      };
    });

    return { rows, reviewLogs };
  } finally {
    database.close();
    sqlPromise = null;
  }
}
