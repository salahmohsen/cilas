import { getPayload } from 'payload'
import config from '../src/payload.config'
import { assertPrivateSearchIsolation, privateClient } from '../src/lib/private-search/config'
import {
  processOutbox,
  rebuild,
  pruneGenerations,
  WRITER_LOCK,
} from '../src/lib/private-search/worker'

const command = process.argv[2]
if (!['work', 'rebuild', 'prune', 'status'].includes(command)) {
  console.error('Expected work, rebuild, prune or status')
  process.exit(1)
}
const payload = await getPayload({ config })
try {
  if (command === 'status') {
    const { rows } = await payload.db.pool.query(
      `WITH writer AS (
      SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory'
        AND classid = 0 AND objid = $1 AND objsubid = 1 AND granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS active
    ) SELECT
      (SELECT count(*)::int FROM spaces_search_outbox) AS pending,
      (SELECT COALESCE(max(attempts), 0) FROM spaces_search_outbox) AS attempts,
      (SELECT COALESCE(EXTRACT(EPOCH FROM now() - min(created_at))::int, 0)
        FROM spaces_search_outbox) AS oldest_seconds,
      generation IS NOT NULL AS initialized, writer.active AS writer_active,
      writer_token IS NOT NULL AND NOT writer.active AS recovery_required
      FROM spaces_search_state CROSS JOIN writer WHERE id = 1`,
      [WRITER_LOCK],
    )
    const status = rows[0]
    console.info(JSON.stringify(status))
    if (
      !status?.initialized ||
      status.recovery_required ||
      status.attempts >= 5 ||
      status.oldest_seconds > 300
    )
      process.exitCode = 1
  } else {
    await assertPrivateSearchIsolation()
    const client = privateClient('write')
    const result =
      command === 'rebuild'
        ? await rebuild(payload, client)
        : command === 'prune'
          ? await pruneGenerations(payload, client)
          : await processOutbox(payload, client)
    console.info(JSON.stringify(result ?? { busy: true }))
    if (result && 'failed' in result && (result.failed > 0 || result.recoveryRequired))
      process.exitCode = 1
  }
} catch {
  console.error('Private search maintenance failed. No document or engine error logged.')
  process.exitCode = 1
} finally {
  await payload.destroy()
}

process.exit(process.exitCode ?? 0)
