import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { Pool } from 'pg'
import { getPayload, type Payload } from 'payload'

import { migrations } from '../src/migrations/index.js'

/**
 * A Payload on its own, fully migrated database, for a test that changes or
 * locks the schema (a migration test). Such a test cannot share the tables the
 * other int files write to: its DDL and table locks block and deadlock them.
 * The database is created next to `DATABASE_URL` and dropped by `destroy`.
 *
 * Payload reads `DATABASE_URL` when its config loads, so the config is
 * imported here, after the variable points at the new database. A spec using
 * this must import nothing that loads the config before it calls this.
 */
export async function scratchPayload(): Promise<{
  payload: Payload
  destroy: () => Promise<void>
}> {
  const shared = process.env.DATABASE_URL
  if (!shared) throw new Error('scratchPayload needs DATABASE_URL')
  const name = `cilas_scratch_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
  const url = (database: string) => {
    const next = new URL(shared)
    next.pathname = `/${database}`
    return next.toString()
  }
  const run = async (statement: string) => {
    const admin = new Pool({ connectionString: url('postgres') })
    try {
      await admin.query(statement)
    } finally {
      await admin.end()
    }
  }

  await run(`CREATE DATABASE ${name}`)
  process.env.DATABASE_URL = url(name)
  try {
    const { default: config } = await import('../src/payload.config.js')
    const payload = await getPayload({ config })
    await payload.db.migrate({
      migrations: migrations.map(({ name, up, down }) => ({
        name,
        up: (args: unknown) => up(args as MigrateUpArgs),
        down: (args: unknown) => down(args as MigrateDownArgs),
      })),
    })
    return {
      payload,
      destroy: async () => {
        await payload.destroy()
        // Payload keeps one pool client checked out for good, so `pool.end()`
        // never finishes. The drop closes the connections instead, and the
        // pool reports each close as an admin shutdown (57P01); any other
        // pool error still throws.
        payload.db.pool.on('error', (error: Error & { code?: string }) => {
          if (error.code !== '57P01') throw error
        })
        process.env.DATABASE_URL = shared
        await run(`DROP DATABASE ${name} WITH (FORCE)`)
      },
    }
  } catch (error) {
    process.env.DATABASE_URL = shared
    await run(`DROP DATABASE ${name} WITH (FORCE)`)
    throw error
  }
}
