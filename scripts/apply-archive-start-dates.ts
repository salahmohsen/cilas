/**
 * ADR 0011, before the fill: writes the start dates and lengths found on the
 * old site into the courses' old `schedule` group, by the rule in
 * `archive-start-dates.ts`. The fill and today's readers both read that group,
 * so the old site and the new sessions agree.
 *
 *   pnpm tsx scripts/apply-archive-start-dates.ts            dry run
 *   pnpm tsx scripts/apply-archive-start-dates.ts --apply    writes
 *
 * Writes the course row and its latest version (a pending draft is what the
 * fill reads) with SQL, not `payload.update`, so the review hooks make or
 * publish no draft. Only missing fields are written; the run is idempotent.
 * Prints the dated course IDs for `migrate-course-sessions.ts --refill`, and
 * the courses left undated with their notes, for a person to read once.
 */
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { decideStartDate, type ResearchEntry } from './archive-start-dates'

const RESEARCH = 'docs/research/2026-11-course-start-dates.json'
const apply = process.argv.includes('--apply')

const research: ResearchEntry[] = JSON.parse(readFileSync(RESEARCH, 'utf8'))
const payload = await getPayload({ config })
const pool = payload.db.pool

type Current = {
  id: number
  start_date: string | null
  weeks: string | null
  version: number | null
  note_en: string | null
  note_ar: string | null
}
const { rows } = await pool.query<Current>(
  `SELECT c.id, to_char(c.schedule_start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS start_date,
          c.schedule_weeks AS weeks, v.id AS version,
          en.schedule_note AS note_en, ar.schedule_note AS note_ar
     FROM courses c
     LEFT JOIN _courses_v v ON v.parent_id = c.id AND v.latest
     LEFT JOIN courses_locales en ON en._parent_id = c.id AND en._locale = 'en'
     LEFT JOIN courses_locales ar ON ar._parent_id = c.id AND ar._locale = 'ar'
    WHERE c.id = ANY($1)`,
  [research.map((e) => e.id)],
)
const byId = new Map(rows.map((r) => [r.id, r]))

const decisions = research.map((e) => {
  const now = byId.get(e.id)
  if (!now) throw new Error(`Course ${e.id} from ${RESEARCH} is not in the database.`)
  return {
    now,
    decision: decideStartDate(e, {
      start_date: now.start_date,
      weeks: now.weeks === null ? null : Number(now.weeks),
    }),
  }
})

const dated = decisions.flatMap(({ now, decision }) => (decision.dated ? [{ now, decision }] : []))
const writes = dated.filter(({ decision }) => Object.keys(decision.writes).length)

if (apply) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const { now, decision } of writes) {
      const { start_date = null, weeks = null } = decision.writes
      await client.query(
        `UPDATE courses SET
           schedule_start_date = COALESCE($2::date::timestamptz, schedule_start_date),
           schedule_start_precision = CASE WHEN $2::date IS NULL THEN schedule_start_precision ELSE 'day' END,
           schedule_weeks = COALESCE($3, schedule_weeks)
         WHERE id = $1`,
        [now.id, start_date, weeks],
      )
      if (now.version !== null)
        await client.query(
          `UPDATE _courses_v SET
             version_schedule_start_date = COALESCE($2::date::timestamptz, version_schedule_start_date),
             version_schedule_start_precision = CASE WHEN $2::date IS NULL THEN version_schedule_start_precision ELSE 'day' END,
             version_schedule_weeks = COALESCE($3, version_schedule_weeks)
           WHERE id = $1`,
          [now.version, start_date, weeks],
        )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const undated = decisions.flatMap(({ now, decision }) =>
  decision.dated
    ? []
    : [{ id: now.id, reason: decision.reason, note: { en: now.note_en, ar: now.note_ar } }],
)
const hasNote = (u: (typeof undated)[number]) => !!(u.note.en || u.note.ar)

console.log(
  JSON.stringify(
    {
      apply,
      dated: dated.length,
      written: writes.map(({ decision: d }) => d.dated && { id: d.id, ...d.writes }),
      differs: dated.flatMap(({ decision: d }) =>
        d.dated && d.differs.length ? [{ id: d.id, differs: d.differs }] : [],
      ),
      refill: dated.map(({ decision }) => decision.id).join(','),
      undated: {
        withNote: undated.filter(hasNote),
        withoutNote: undated.filter((u) => !hasNote(u)),
      },
    },
    null,
    2,
  ),
)
process.exit(0)
