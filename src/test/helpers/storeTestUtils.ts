/**
 * Converts an array of entities with `id` fields into a Record keyed by id.
 * Useful for test helpers that produce arrays (e.g. buildEntitiesFromRows)
 * when the store expects Record<string, T>.
 */
export function toRecordById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}
