let pendingFirestoreWrite: Promise<void> = Promise.resolve();

/**
 * Firestore's Web SDK has one shared pending-write queue per app instance.
 * Keep writes from independent sync features ordered so a large learning
 * snapshot cannot be starved by background telemetry writes (or vice versa).
 */
export function enqueueFirestoreWrite<T>(operation: () => Promise<T>): Promise<T> {
  const scheduledOperation = pendingFirestoreWrite.then(operation, operation);

  pendingFirestoreWrite = scheduledOperation.then(
    () => undefined,
    () => undefined,
  );

  return scheduledOperation;
}
