import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

/**
 * The live database as seed data: every table's rows, as JSON, in
 * seed/data/live/<table>.json. `pnpm db:seed` restores it after
 * `migrate:fresh`, so a reset reproduces the site exactly — locales, drafts,
 * versions, ids — rather than rebuilding it from the archive. Media files
 * live in R2 and are untouched; only their rows are kept here.
 *
 * Restoring inserts rows with foreign-key triggers off, which needs a
 * superuser connection (a self-hosted Postgres, not Neon).
 *
 * Left out: migrations (the reset writes its own), sessions, locks and admin
 * preferences, form submissions (applicants' personal data), and user
 * accounts: the repository is public, and accounts hold emails and password
 * hashes. A restore recreates only the super admin (seed/super-admin.ts).
 */
export const SNAPSHOT_DIR = path.join(import.meta.dirname, 'data', 'live')
const SKIP = new Set([
  'payload_migrations',
  'users',
  'users_roles',
  'users_sessions',
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'payload_preferences',
  'payload_preferences_rels',
  'form_submissions',
  'form_submissions_submission_data',
  'form_submissions_rels',
])

type Client = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}
type Pool = Client & { connect: () => Promise<Client & { release: () => void }> }
const poolOf = (payload: Payload): Pool => (payload.db as unknown as { pool: Pool }).pool
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`

const tables = async (pool: Client): Promise<string[]> =>
  (
    await pool.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    )
  ).rows
    .map((r) => String(r.table_name))
    .filter((t) => !SKIP.has(t))

export const exportSnapshot = async (payload: Payload, dir = SNAPSHOT_DIR): Promise<void> => {
  const pool = poolOf(payload)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let rows = 0
  for (const table of await tables(pool)) {
    const hasId = (
      await pool.query(
        `select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'id'`,
        [table],
      )
    ).rows.length
    const data = (await pool.query(`select * from ${ident(table)}${hasId ? ' order by id' : ''}`))
      .rows
    writeFileSync(path.join(dir, `${table}.json`), `${JSON.stringify(data, null, 1)}\n`)
    rows += data.length
  }
  console.log(`snapshot: ${rows} rows written to ${path.relative(process.cwd(), dir)}`)
}

export const hasSnapshot = (dir = SNAPSHOT_DIR): boolean =>
  existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.json'))

/**
 * Restores the snapshot into a freshly migrated database. Only columns the
 * current schema still has are written, so a snapshot survives an added or
 * dropped field; each id sequence then continues after the restored rows.
 */
export const restoreSnapshot = async (payload: Payload, dir = SNAPSHOT_DIR): Promise<void> => {
  const pool = await poolOf(payload).connect()
  const live = new Set(await tables(pool))
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  await pool.query('begin')
  try {
    await pool.query(`set session_replication_role = replica`)
    for (const table of live) await pool.query(`delete from ${ident(table)}`)
    let rows = 0
    for (const f of files) {
      const table = f.replace(/\.json$/, '')
      if (!live.has(table)) {
        console.log(`snapshot: ${table} is not in the schema, skipped`)
        continue
      }
      const data = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>[]
      if (!data.length) continue
      const columns = new Set(
        (
          await pool.query(
            `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
            [table],
          )
        ).rows.map((r) => String(r.column_name)),
      )
      const keys = Object.keys(data[0]).filter((k) => columns.has(k))
      const BATCH = 200
      for (let i = 0; i < data.length; i += BATCH) {
        const chunk = data.slice(i, i + BATCH)
        const params: unknown[] = []
        const values = chunk.map(
          (row) =>
            `(${keys
              .map((k) => {
                const v = row[k]
                params.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v)
                return `$${params.length}`
              })
              .join(', ')})`,
        )
        await pool.query(
          `insert into ${ident(table)} (${keys.map(ident).join(', ')}) values ${values.join(', ')}`,
          params,
        )
      }
      rows += data.length
      // Snapshots from before `people.visible` showed everyone; the column's
      // default hides new people, so restore them as shown.
      if (table === 'people' && !('visible' in data[0]) && columns.has('visible')) {
        await pool.query(`update people set visible = true`)
      }
    }
    await pool.query(`set session_replication_role = origin`)
    // Each serial id continues after the highest restored id.
    const sequences = (
      await pool.query(
        `select table_name, column_name, pg_get_serial_sequence(quote_ident(table_name), column_name) as seq
           from information_schema.columns
          where table_schema = 'public' and column_default like 'nextval(%'`,
      )
    ).rows
    for (const s of sequences) {
      if (!s.seq) continue
      await pool.query(
        `select setval($1, coalesce((select max(${ident(String(s.column_name))}) from ${ident(String(s.table_name))}), 0) + 1, false)`,
        [s.seq],
      )
    }
    await pool.query('commit')
    console.log(`snapshot: ${rows} rows restored`)
  } catch (e) {
    await pool.query('rollback')
    throw e
  } finally {
    pool.release()
  }
}
