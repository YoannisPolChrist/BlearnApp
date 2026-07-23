import { describe, expect, it } from 'vitest';
import { splitEntityWriteChunks } from './entities';

describe('splitEntityWriteChunks', () => {
  it('keeps a batch below its payload budget before reaching the write-count limit', () => {
    const chunks = splitEntityWriteChunks(
      [
        { id: 'one', payload: 'a'.repeat(100) },
        { id: 'two', payload: 'b'.repeat(100) },
        { id: 'three', payload: 'c'.repeat(100) },
      ],
      'device-1',
      300,
    );

    expect(chunks.map((chunk) => chunk.map((item) => item.id))).toEqual([
      ['one'],
      ['two'],
      ['three'],
    ]);
  });

  it('still permits a single oversized item so a caller can surface its real document error', () => {
    const chunks = splitEntityWriteChunks(
      [{ id: 'one', payload: 'a'.repeat(1_000) }],
      'device-1',
      100,
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
  });
});
