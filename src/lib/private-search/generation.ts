import type { Payload } from 'payload'

export class RecoveryRequired extends Error {}
export const activeGeneration = async (payload: Payload): Promise<string> => {
  const { rows } = await payload.db.pool.query<{ generation: string | null }>(
    'SELECT generation FROM spaces_search_state WHERE id = 1',
  )
  const generation = rows[0]?.generation
  if (!generation || !/^spaces_search_[a-f0-9]{32}$/.test(generation)) throw new RecoveryRequired()
  return generation
}
