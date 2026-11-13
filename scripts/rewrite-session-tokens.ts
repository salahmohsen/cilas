/**
 * ADR 0011, plan "Move course readers to sessions", unit 4: space posts and
 * comments name course sessions in their bodies, as `[#N Title](session:<id>)`
 * and `::session[<id>]`. The IDs were rows of the course's old `sessions`
 * array; this rewrites each to its session's ID through the map the sessions
 * fill wrote (`course-sessions-map.json`: old row ID → session ID).
 *
 *   pnpm tsx scripts/rewrite-session-tokens.ts [--map course-sessions-map.json] [--apply]
 *
 * Without `--apply` it only reports. Idempotent: a token that already names
 * an existing session stays, so a second run changes nothing. A token whose
 * ID is neither in the map nor a session is reported and left as it is,
 * never guessed. Writes the rows straight (no hooks, no new versions): the
 * same text with new IDs, in the current rows and their versions alike.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPayload } from 'payload'

import { renameSessionRefs, sessionIdsIn } from '../src/lib/session-refs'
import config from '../src/payload.config'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const apply = process.argv.includes('--apply')
const mapPath = resolve(arg('--map') ?? 'course-sessions-map.json')
if (!existsSync(mapPath)) throw new Error(`No map at ${mapPath}`)
const map: Record<string, number> = JSON.parse(readFileSync(mapPath, 'utf8'))

/** Every table and column that holds a space post or comment body. */
const BODIES = [
  { table: 'space_posts', column: 'body' },
  { table: '_space_posts_v', column: 'version_body' },
  { table: 'space_comments', column: 'body' },
  { table: '_space_comments_v', column: 'version_body' },
] as const

const payload = await getPayload({ config })
const pool = payload.db.pool

const { rows: sessionRows } = await pool.query<{ id: number }>('SELECT id FROM sessions')
const sessions = new Set(sessionRows.map((r) => String(r.id)))
// A mapped session that the refill deleted would point at nothing: reported, not written.
const target = (id: string): string | null => {
  if (sessions.has(id)) return id
  const to = map[id]
  return to !== undefined && sessions.has(String(to)) ? String(to) : null
}

const unknown = new Map<string, string[]>()
let failed = false
for (const { table, column } of BODIES) {
  const { rows } = await pool.query<{ id: number; body: string }>(
    `SELECT id, "${column}" AS body FROM "${table}"
      WHERE "${column}" ~ '(\\]\\(session:|::session\\[)' ORDER BY id`,
  )
  let changed = 0
  for (const row of rows) {
    for (const id of sessionIdsIn(row.body))
      if (!target(id))
        unknown.set(`${table}#${row.id}`, [...(unknown.get(`${table}#${row.id}`) ?? []), id])
    const body = renameSessionRefs(row.body, (id) => target(id) ?? id)
    if (body === row.body) continue
    changed++
    if (apply)
      await pool.query(`UPDATE "${table}" SET "${column}" = $2 WHERE id = $1`, [row.id, body])
  }
  console.log(
    `${table}.${column}: ${rows.length} with tokens, ${changed} ${apply ? 'rewritten' : 'to rewrite'}`,
  )
}
for (const [row, ids] of unknown) {
  failed = true
  console.log(`Unknown session ID(s) in ${row}: ${ids.join(', ')} (left as they are)`)
}
process.exit(failed ? 1 : 0)
