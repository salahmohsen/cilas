import assert from 'node:assert/strict'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { sql } from '@payloadcms/db-postgres'
import { up, down } from '../src/migrations/20261029_034244_event_single_timing'
import { expandSchedule, type Schedule } from '../src/lib/schedule'
import { eventTiming } from '../src/lib/events'

const url = new URL(process.env.DATABASE_URL ?? '')
assert.equal(url.hostname, 'localhost', 'Rehearsal requires an isolated local restore')
assert.equal(url.port, '5433')
assert.equal(
  url.pathname,
  '/cilas_admin_refactor',
  'Never rehearse against the shared development DB',
)
const db = drizzle({ connection: url.toString() })
const rollback = new Error('rehearsal complete; rollback')

try {
  await db.transaction(async (tx) => {
    const read = async () => {
      const result = await tx.execute(sql`
        SELECT to_jsonb(e) AS event,
          COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s._order)
            FROM events_schedule_slots s WHERE s._parent_id = e.id), '[]') AS slots,
          COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a._order)
            FROM events_agenda a WHERE a._parent_id = e.id), '[]') AS agenda,
          COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
            FROM events_locales l WHERE l._parent_id = e.id), '[]') AS locales
        FROM events e ORDER BY e.id
      `)
      return result.rows.map((row) => {
        const e = row.event as Record<string, unknown>
        const schedule = Object.fromEntries(
          Object.entries(e)
            .filter(([key]) => key.startsWith('schedule_'))
            .map(([key, value]) => [key.slice('schedule_'.length), value]),
        ) as Schedule
        schedule.slots = row.slots as Schedule['slots']
        const agenda = row.agenda as Array<{ start_time: string; end_time: string; title: string }>
        return {
          id: e.id,
          occurrences: expandSchedule(schedule),
          timing: eventTiming({ schedule, agenda }, new Date('2026-10-29T12:00:00Z')),
          content: Object.fromEntries(
            Object.entries(e).filter(([key]) => !key.startsWith('schedule_')),
          ),
          agenda: row.agenda,
          locales: row.locales,
        }
      })
    }

    const before = await read()
    await up({ db: tx })
    assert.deepEqual(await read(), before, 'Upgrade changed existing event timing or content')

    await tx.execute(sql`
      INSERT INTO events (tier, event_type, slug, schedule_mode, schedule_start_date,
        schedule_start_time, schedule_end_time)
      VALUES ('owner', 'screening', 'migration-rehearsal-screening', 'single',
        '2026-10-30T12:00:00Z', '19:00', '21:00')
    `)
    const withNew = await read()
    assert.equal(withNew.length, before.length + 1)
    assert.deepEqual(withNew.at(-1)?.occurrences, [
      { date: '2026-10-30', start_time: '19:00', end_time: '21:00' },
    ])
    await down({ db: tx })
    assert.deepEqual(await read(), withNew, 'Rollback lost existing or newly authored event data')
    await up({ db: tx })
    assert.deepEqual(await read(), withNew, 'Re-upgrade changed event data')
    console.log(
      JSON.stringify({
        existingEvents: before.length,
        upgradeParity: true,
        rollbackParity: true,
        newlyAuthoredEventPreserved: true,
        reupgradeParity: true,
      }),
    )
    throw rollback
  })
} catch (error) {
  if (error !== rollback) throw error
} finally {
  await db.$client.end()
}
