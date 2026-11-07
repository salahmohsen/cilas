import type { Payload } from 'payload'

import { GENERATION_PATTERN, STATE_TABLE } from './names'

export class RecoveryRequired extends Error {}
export const activeGeneration = async (payload: Payload): Promise<string> => {
  const { rows } = await payload.db.pool.query<{ generation: string | null }>(
    `SELECT generation FROM ${STATE_TABLE} WHERE id = 1`,
  )
  const generation = rows[0]?.generation
  if (!generation || !GENERATION_PATTERN.test(generation)) throw new RecoveryRequired()
  return generation
}
