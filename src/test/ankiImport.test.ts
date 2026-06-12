import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import initSqlJs from 'sql.js';
import { encodeBase64Bytes, parseAnkiPackage } from '@/lib/ankiImport';

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_REVIEW_AT = 1_700_200_000_000;

async function buildMinimalApkg(): Promise<ArrayBuffer> {
  const SQL = await initSqlJs({
    locateFile: () => path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  });
  const db = new SQL.Database();
  const collectionCreatedAtSeconds = 1_700_000_000;
  const cardCreatedAt = 1_700_100_000_000;

  db.run('CREATE TABLE col (decks text, models text, crt integer)');
  db.run('CREATE TABLE notes (id integer, mid integer, tags text, flds text, sfld text, mod integer)');
  db.run('CREATE TABLE cards (id integer, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, mod integer)');
  db.run('CREATE TABLE revlog (id integer, cid integer)');

  db.run(
    'INSERT INTO col VALUES (?, ?, ?)',
    [
      JSON.stringify({
        '1': { name: 'Demo Deck', desc: '<b>Beschreibung</b>' },
      }),
      JSON.stringify({
        '10': {
          name: 'Basic',
          type: 0,
          css: '.card { color: purple; } .accent { font-weight: 700; }',
          flds: [{ name: 'Front' }, { name: 'Back' }],
          tmpls: [{ qfmt: '<div class="accent">{{Front}}</div>', afmt: '{{FrontSide}}<hr id=answer><div class="back">{{Back}}</div>' }],
        },
      }),
      collectionCreatedAtSeconds,
    ],
  );
  db.run(
    'INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)',
    [
      10,
      10,
      'anki imported',
      '<div>bonjour</div><img src="card.png">\u001f<div>Hallo</div>',
      'bonjour',
      Math.floor(LAST_REVIEW_AT / 1000),
    ],
  );
  db.run(
    'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      cardCreatedAt,
      10,
      1,
      0,
      2,
      2,
      5,
      12,
      2350,
      9,
      1,
      0,
      Math.floor(LAST_REVIEW_AT / 1000),
    ],
  );
  db.run('INSERT INTO revlog VALUES (?, ?)', [LAST_REVIEW_AT, cardCreatedAt]);

  const bytes = db.export();
  db.close();

  const archive = zipSync({
    'collection.anki2': bytes,
    media: strToU8(JSON.stringify({ '0': 'card.png' })),
    '0': new Uint8Array([137, 80, 78, 71]),
  });

  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
}

async function buildFormattingApkg(): Promise<ArrayBuffer> {
  const SQL = await initSqlJs({
    locateFile: () => path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  });
  const db = new SQL.Database();

  db.run('CREATE TABLE col (decks text, models text, crt integer)');
  db.run('CREATE TABLE notes (id integer, mid integer, tags text, flds text, sfld text, mod integer)');
  db.run('CREATE TABLE cards (id integer, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, mod integer)');
  db.run('CREATE TABLE revlog (id integer, cid integer)');

  db.run(
    'INSERT INTO col VALUES (?, ?, ?)',
    [
      JSON.stringify({
        '1': { name: 'Japanese::Core', desc: 'JP' },
      }),
      JSON.stringify({
        '11': {
          name: 'Furigana',
          type: 0,
          css: '.card { text-align: left; } .meta { color: teal; }',
          flds: [{ name: 'Front' }, { name: 'Back' }],
          tmpls: [
            {
              name: 'Card 1',
              qfmt: '{{furigana:Front}}<div class="meta">{{Deck}} / {{Subdeck}} / {{Type}} / {{Card}}</div>{{hint:Back}}',
              afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
            },
          ],
        },
      }),
      1_700_000_000,
    ],
  );

  db.run(
    'INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)',
    [11, 11, 'jp ruby', '日本語[にほんご]\u001fmeaning', '日本語', Math.floor(LAST_REVIEW_AT / 1000)],
  );
  db.run(
    'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [1_700_100_000_123, 11, 1, 0, 0, 0, 0, 0, 2500, 0, 0, 0, Math.floor(LAST_REVIEW_AT / 1000)],
  );

  const bytes = db.export();
  db.close();
  const archive = zipSync({
    'collection.anki2': bytes,
    media: strToU8('{}'),
  });

  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
}

describe('anki package parsing', () => {
  it('parses a minimal Anki package into importable learn rows', async () => {
    const buffer = await buildMinimalApkg();
    const result = await parseAnkiPackage('demo.apkg', buffer);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].deck).toBe('Demo Deck');
    expect(result.rows[0].deckDescription).toBe('Beschreibung');
    expect(result.rows[0].front).toBe('bonjour');
    expect(result.rows[0].back).toContain('bonjour');
    expect(result.rows[0].back).toContain('Hallo');
    expect(result.rows[0].frontHtml).toContain('<div class="accent">');
    expect(result.rows[0].frontHtml).toContain('<div>bonjour</div>');
    expect(result.rows[0].frontHtml).toContain('<img');
    expect(result.rows[0].backHtml).toContain('bonjour');
    expect(result.rows[0].backHtml).toContain('<div class="back"><div>Hallo</div></div>');
    expect(result.rows[0].templateCss).toContain('.accent');
    expect(result.rows[0].templateCardClass).toBe('card card1');
    expect(result.rows[0].anki?.note?.noteId).toBe('10');
    expect(result.rows[0].anki?.card?.cardId).toBe('1700100000000');
    expect(result.rows[0].anki?.note?.fields[0]?.name).toBe('Front');
    expect(result.rows[0].card?.state).toBe('review');
    expect(result.rows[0].card?.dueAt).toBe(1_700_000_000_000 + 5 * DAY_MS);
    expect(result.rows[0].card?.reps).toBe(9);
    expect(result.rows[0].card?.lastReviewedAt).toBe(LAST_REVIEW_AT);
    expect(result.reviewLogs).toHaveLength(1);
    expect(result.reviewLogs[0]?.sourceCardId).toBe('1700100000000');
    expect(result.reviewLogs[0]?.anki?.reviewId).toBe(String(LAST_REVIEW_AT));
  });

  it('preserves hint, ruby and special field formatting in rendered html', async () => {
    const buffer = await buildFormattingApkg();
    const result = await parseAnkiPackage('formatting.apkg', buffer);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].frontHtml).toContain('<ruby>日本語<rt>にほんご</rt></ruby>');
    expect(result.rows[0].frontHtml).toContain('Japanese::Core / Core / Furigana / Card 1');
    expect(result.rows[0].frontHtml).toContain('<details class="anki-hint">');
    expect(result.rows[0].backHtml).toContain('meaning');
    expect(result.rows[0].templateCss).toContain('.meta');
    expect(result.rows[0].templateCardClass).toBe('card card1');
  });

  it('encodes large byte arrays without spreading the full buffer in browser mode', () => {
    const originalBuffer = globalThis.Buffer;
    try {
      Object.defineProperty(globalThis, 'Buffer', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const encoded = encodeBase64Bytes(new Uint8Array(96_000));
      expect(encoded).toHaveLength(128_000);
    } finally {
      Object.defineProperty(globalThis, 'Buffer', {
        value: originalBuffer,
        configurable: true,
        writable: true,
      });
    }
  });
});
