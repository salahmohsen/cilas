import type { Payload } from 'payload'

import { cairoClock } from '@/lib/space-email-schedule'
import { runDigests, type DigestRun } from '@/lib/space-digest'
import { purgeDeleted, type PurgeCounts } from '@/lib/space-purge'

/** The purge runs once a day, in this Cairo hour, when the site is quiet. */
export const PURGE_HOUR = 3

/** One Postgres advisory lock for the whole job, shared by every app instance. */
export const CRON_LOCK = 192834712

export type CronResult =
  | { busy: true }
  | { busy?: false; digests: DigestRun; purge: PurgeCounts | 'skipped' }

/**
 * What the hourly schedule runs: the digests (they pick their own hour) and
 * the daily purge. A session lock on its own connection means a second call,
 * from this instance or another, returns busy instead of running beside it.
 */
export const runSpacesCron = async (
  payload: Payload,
  now: Date = new Date(),
  options: { pause?: number } = {},
): Promise<CronResult> => {
  const connection = await payload.db.pool.connect()
  let locked = false
  let broken = false
  connection.on('error', () => {
    broken = true
  })
  try {
    const got = await connection.query('SELECT pg_try_advisory_lock($1) AS locked', [CRON_LOCK])
    locked = Boolean(got.rows[0].locked)
    if (!locked) return { busy: true }
    const digests = await runDigests(payload, now, options)
    const purge = cairoClock(now).hour === PURGE_HOUR ? await purgeDeleted(payload, now) : 'skipped'
    return { digests, purge }
  } finally {
    try {
      if (locked && !broken) await connection.query('SELECT pg_advisory_unlock($1)', [CRON_LOCK])
    } finally {
      connection.release(broken)
    }
  }
}
