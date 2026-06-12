import { zipSync } from 'fflate';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import type {
  LearningCard,
  LearningDeck,
  LearningNote,
  ReviewLog,
  ReviewRating,
  LearningCardState,
} from '../domain/entities';

const DAY_MS = 24 * 60 * 60 * 1000;

let sqlPromise: Promise<SqlJsStatic> | null = null;

function resolveSqlWasmPath(): string {
  const sqlWasmAssetUrl = new URL('../../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url);
  if (typeof window === 'undefined') {
    const decoded = decodeURIComponent(sqlWasmAssetUrl.pathname);
    return /^\/[a-zA-Z]:\//.test(decoded) ? decoded.slice(1) : decoded;
  }
  return sqlWasmAssetUrl.href;
}

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => resolveSqlWasmPath() });
  }
  return sqlPromise;
}

/** Maps a Blearn ReviewRating to the Anki ease integer (1-4). */
function ratingToAnkiEase(rating: ReviewRating): number {
  switch (rating) {
    case 'again': return 1;
    case 'hard':  return 2;
    case 'good':  return 3;
    case 'easy':  return 4;
  }
}

/** Maps a Blearn LearningCardState to the Anki revlog type (0-3). */
function stateToAnkiRevlogType(state: LearningCardState): number {
  switch (state) {
    case 'new':        return 0;
    case 'learning':   return 0;
    case 'review':     return 1;
    case 'relearning': return 2;
  }
}

/** Maps a Blearn LearningCardState to Anki card type + queue values. */
function stateToAnkiTypeAndQueue(
  state: LearningCardState,
  dueAt: number,
  intervalDays: number,
  now: number,
): { type: number; queue: number; due: number } {
  switch (state) {
    case 'review': {
      // Anki review cards: due = day offset from collection-creation
      // We use days from now since we're creating a fresh collection
      const dueDayOffset = Math.max(0, Math.round((dueAt - now) / DAY_MS));
      return { type: 2, queue: 2, due: dueDayOffset };
    }
    case 'learning': {
      // Anki learning cards: due = unix timestamp (seconds)
      return { type: 1, queue: 1, due: Math.floor(dueAt / 1000) };
    }
    case 'relearning': {
      return { type: 3, queue: 1, due: Math.floor(dueAt / 1000) };
    }
    case 'new':
    default: {
      // due = position in new queue
      return { type: 0, queue: 0, due: Math.floor(Math.random() * 100000) };
    }
  }
}

export interface AnkiExportPayload {
  deck: LearningDeck;
  notes: LearningNote[];
  /** Map from noteId to the cards belonging to it */
  cards: LearningCard[];
  revlogs: ReviewLog[];
}

/**
 * Creates a valid Anki `.apkg` package from Blearn deck data.
 *
 * The returned `Uint8Array` can be offered as a file download with the
 * `.apkg` extension. It can then be imported directly into Anki Desktop
 * or AnkiDroid – including all review-log history so Anki's FSRS
 * Optimizer can learn from the existing Blearn review data.
 */
export async function createAnkiPackage(payload: AnkiExportPayload): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // ── Schema ──────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE col (
      id      INTEGER PRIMARY KEY,
      crt     INTEGER NOT NULL,
      mod     INTEGER NOT NULL,
      scm     INTEGER NOT NULL,
      ver     INTEGER NOT NULL,
      dty     INTEGER NOT NULL,
      usn     INTEGER NOT NULL,
      ls      INTEGER NOT NULL,
      conf    TEXT NOT NULL,
      models  TEXT NOT NULL,
      decks   TEXT NOT NULL,
      dconf   TEXT NOT NULL,
      tags    TEXT NOT NULL
    );
    CREATE TABLE notes (
      id    INTEGER PRIMARY KEY,
      guid  TEXT NOT NULL,
      mid   INTEGER NOT NULL,
      mod   INTEGER NOT NULL,
      usn   INTEGER NOT NULL,
      tags  TEXT NOT NULL,
      flds  TEXT NOT NULL,
      sfld  TEXT NOT NULL,
      csum  INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data  TEXT NOT NULL
    );
    CREATE TABLE cards (
      id     INTEGER PRIMARY KEY,
      nid    INTEGER NOT NULL,
      did    INTEGER NOT NULL,
      ord    INTEGER NOT NULL,
      mod    INTEGER NOT NULL,
      usn    INTEGER NOT NULL,
      type   INTEGER NOT NULL,
      queue  INTEGER NOT NULL,
      due    INTEGER NOT NULL,
      ivl    INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      reps   INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      left   INTEGER NOT NULL,
      odue   INTEGER NOT NULL,
      odid   INTEGER NOT NULL,
      flags  INTEGER NOT NULL,
      data   TEXT NOT NULL
    );
    CREATE TABLE revlog (
      id      INTEGER PRIMARY KEY,
      cid     INTEGER NOT NULL,
      usn     INTEGER NOT NULL,
      ease    INTEGER NOT NULL,
      ivl     INTEGER NOT NULL,
      lastIvl INTEGER NOT NULL,
      factor  INTEGER NOT NULL,
      time    INTEGER NOT NULL,
      type    INTEGER NOT NULL
    );
    CREATE INDEX ix_notes_usn   ON notes (usn);
    CREATE INDEX ix_cards_usn   ON cards (usn);
    CREATE INDEX ix_revlog_usn  ON revlog (usn);
    CREATE INDEX ix_cards_nid   ON cards (nid);
    CREATE INDEX ix_cards_sched ON cards (did, queue, due);
    CREATE INDEX ix_revlog_cid  ON revlog (cid);
  `);

  // ── Stable IDs ──────────────────────────────────────────────────────────────
  // Anki uses simple integer IDs; we derive them from the deck/note hash to
  // keep re-exports re-importable without duplicates.
  const deckId = 1_000_000_001;
  const modelId = 1_000_000_002;

  // ── Model (Note type = "Basic (and reversed card)" equivalent) ───────────────
  const model = {
    id: modelId,
    name: payload.deck.name,
    type: 0,  // 0 = standard, 1 = cloze
    mod:  nowSec,
    usn:  -1,
    sortf: 0,
    ver:  11,
    css:  '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
    flds: [
      { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      { name: 'Back',  ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
    ],
    tmpls: [
      {
        name: 'Card 1',
        ord:  0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
        bqfmt: '',
        bafmt: '',
        did:  null,
        bfont: '',
        bsize: 0,
      },
    ],
    tags: [],
    req: [[0, 'any', [0]]],
  };

  const deck = {
    id:          deckId,
    name:        payload.deck.name,
    desc:        payload.deck.description || '',
    mod:         nowSec,
    usn:         -1,
    lrnToday:    [0, 0],
    revToday:    [0, 0],
    newToday:    [0, 0],
    timeToday:   [0, 0],
    collapsed:   false,
    browserCollapsed: false,
    extendNew:   10,
    extendRev:   50,
    conf:        1,
    dyn:         0,
  };

  const dconf = {
    "1": {
      id: 1, name: 'Default', replayq: true, lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 1, mult: 0 },
      rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500, bury: false, hardFactor: 1.2 },
      new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 0], initialFactor: 2500, bury: false, order: 1 },
      maxTaken: 60, timer: 0, autoplay: true, mod: 0, usn: 0,
    },
  };

  // ── Insert col ───────────────────────────────────────────────────────────────
  db.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      nowSec,
      now,
      now,
      11,
      0,
      -1,
      0,
      '{}',
      JSON.stringify({ [String(modelId)]: model }),
      JSON.stringify({ [String(deckId)]: deck }),
      JSON.stringify(dconf),
      '{}',
    ],
  );

  // ── Build noteId lookup (Blearn noteId → small integer) ──────────────────────
  // Anki integer IDs must be unique; we use Date.now() + index as base.
  // We use a seed so that the same deck always produces the same IDs (useful
  // for re-imports).
  const notesByBlearnId = new Map<string, LearningNote>();
  payload.notes.forEach((n) => notesByBlearnId.set(n.id, n));

  // stable integer ID from a string hash (djb2)
  function stableIntId(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    // Keep positive and in safe integer range, offset past 1e12 so Anki
    // treats it as a millisecond timestamp (> 1e12).
    return (Math.abs(h) % 1_000_000_000) + 1_571_000_000_000;
  }

  // ── Insert Notes ─────────────────────────────────────────────────────────────
  const insertNote = db.prepare(
    `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const noteAnkiIdByBlearnId = new Map<string, number>();

  payload.notes.forEach((note) => {
    const ankiNoteId = stableIntId(`note:${note.id}`);
    noteAnkiIdByBlearnId.set(note.id, ankiNoteId);

    const front = note.frontHtml || note.front || '';
    const back  = note.backHtml  || note.back  || '';
    const flds  = `${front}\x1f${back}`;
    const tags  = (note.tags ?? []).join(' ');
    // Simple checksum: sum of char codes of the sort field
    const csum  = front.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) & 0xffffffff;
    const guid  = note.anki?.noteId ?? note.id.replace(/-/g, '').substring(0, 10);

    insertNote.run([ankiNoteId, guid, modelId, nowSec, -1, tags, flds, front, csum, 0, '']);
  });

  insertNote.free();

  // ── Insert Cards ─────────────────────────────────────────────────────────────
  const insertCard = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const cardAnkiIdByBlearnId = new Map<string, number>();

  payload.cards.forEach((card) => {
    const ankiCardId  = stableIntId(`card:${card.id}`);
    const ankiNoteId  = noteAnkiIdByBlearnId.get(card.noteId) ?? stableIntId(`note:${card.noteId}`);
    cardAnkiIdByBlearnId.set(card.id, ankiCardId);

    const { type, queue, due } = stateToAnkiTypeAndQueue(card.state, card.dueAt, card.intervalDays, now);
    // Anki ease factor is stored as 10x (e.g. 2500 = 2.5)
    const ankiFactor = Math.round((card.easeFactor ?? 2.5) * 1000);

    insertCard.run([
      ankiCardId,
      ankiNoteId,
      deckId,
      0,                 // ord (template index)
      nowSec,
      -1,
      type,
      queue,
      due,
      card.intervalDays,
      ankiFactor,
      card.reps,
      card.lapses,
      0,
      0,
      0,
      0,
      '',
    ]);
  });

  insertCard.free();

  // ── Insert RevLog ─────────────────────────────────────────────────────────────
  const insertRevlog = db.prepare(
    `INSERT INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  payload.revlogs.forEach((log, idx) => {
    const ankiCardId = cardAnkiIdByBlearnId.get(log.cardId) ?? stableIntId(`card:${log.cardId}`);
    const ease       = ratingToAnkiEase(log.rating);
    const type       = stateToAnkiRevlogType(log.previousState);
    const ankiFactor = 2500; // we don't track ease-factor snapshots per log

    // Anki revlog id = millisecond timestamp, must be unique
    const revlogId = log.reviewedAt + idx;

    // ivl: positive = days, negative = seconds (for learning steps)
    const ivl = log.previousState === 'review'
      ? log.scheduledDays
      : -Math.round((log.elapsedDays * DAY_MS) / 1000);

    insertRevlog.run([revlogId, ankiCardId, -1, ease, ivl, 0, ankiFactor, 0, type]);
  });

  insertRevlog.free();

  // ── Export to .apkg ───────────────────────────────────────────────────────────
  const dbBytes = db.export();
  db.close();

  const zipEntries: Record<string, Uint8Array> = {
    'collection.anki21': dbBytes,
    'media':             new TextEncoder().encode('{}'),
  };

  return zipSync(zipEntries);
}
