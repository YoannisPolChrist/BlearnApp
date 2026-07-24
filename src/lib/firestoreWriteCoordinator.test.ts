import { describe, expect, it } from 'vitest';
import { enqueueFirestoreWrite } from './firestoreWriteCoordinator';

describe('enqueueFirestoreWrite', () => {
  it('keeps independent Firestore writers strictly ordered', async () => {
    const order: string[] = [];
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });

    const firstWrite = enqueueFirestoreWrite(async () => {
      order.push('first:start');
      await firstWriteGate;
      order.push('first:finish');
    });
    const secondWrite = enqueueFirestoreWrite(async () => {
      order.push('second');
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    releaseFirstWrite?.();
    await Promise.all([firstWrite, secondWrite]);

    expect(order).toEqual(['first:start', 'first:finish', 'second']);
  });
});
