/**
 * Puts `item` at index `to` of `rows` once its old place `from` is empty.
 * `from` is null for a new item. `to` is clamped to the list.
 */
export function place<T>(rows: readonly T[], from: number | null, item: T, to: number): T[] {
  const rest = from === null ? [...rows] : rows.filter((_, i) => i !== from)
  rest.splice(Math.min(Math.max(to, 0), rest.length), 0, item)
  return rest
}

/** Which way an item at `index` of `total` can still move. Neither way when it is alone. */
export const moves = (index: number, total: number) => ({
  up: total > 1 && index > 0,
  down: total > 1 && index < total - 1,
})
