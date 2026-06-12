import type { ImportableRow, ReviewLog } from '../domain/entities';

export interface ParsedAnkiImport {
  rows: ImportableRow[];
  reviewLogs: Array<Omit<ReviewLog, 'id' | 'deckId' | 'cardId'> & {
    sourceCardId: string;
  }>;
}

export { parseAnkiPackage } from '@/lib/ankiImport';
