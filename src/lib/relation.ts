export function relId<T extends number | string | { id: number | string } | null | undefined>(
  value: T,
): T extends { id: infer I } ? I : T
export function relId(value: unknown): number | string | null | undefined
export function relId(value: unknown): number | string | null | undefined {
  if (value == null) return value
  if (typeof value === 'number' || typeof value === 'string') return value
  return typeof value === 'object' && 'id' in value
    ? (value as { id: number | string }).id
    : undefined
}

export const relation = <T>(value: unknown): T | null =>
  typeof value === 'object' && value !== null ? (value as T) : null

export const isRelation = <T>(value: unknown): value is T => relation<T>(value) !== null
