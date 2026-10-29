import assert from 'node:assert/strict'
import { createLocalReq, getPayload } from 'payload'
import {
  sql,
  type PostgresAdapter,
  type MigrateUpArgs,
  type MigrateDownArgs,
} from '@payloadcms/db-postgres'
import type { Event } from '../src/payload-types'
import config from '../src/payload.config'
import { down, up } from '../src/migrations/20261029_075239_event_drafts'

const url = new URL(process.env.DATABASE_URL ?? '')
assert.equal(url.hostname, 'localhost')
assert.equal(url.port, '5433')
assert.ok(['/cilas_admin_refactor', '/cilas_admin_checks'].includes(url.pathname))
const payload = await getPayload({ config })
assert.equal(payload.db.name, 'postgres')
const sessions = payload.db.sessions as PostgresAdapter['sessions'] | undefined
assert.ok(sessions)
try {
  if (process.argv.includes('--apply-to-checks')) {
    assert.equal(url.pathname, '/cilas_admin_checks')
    await payload.db.migrate({
      migrations: [
        {
          name: '20261029_075239_event_drafts',
          up: (args) => up(args as MigrateUpArgs),
          down: (args) => down(args as MigrateDownArgs),
        },
      ],
    })
  } else {
    assert.equal(url.pathname, '/cilas_admin_refactor')
    const ids = (await payload.db.pool.query('SELECT id FROM events ORDER BY id')).rows
    for (const { id } of ids) {
      const doc = await payload.db.findOne<Event>({
        collection: 'events',
        locale: 'all',
        where: { id: { equals: id } },
      })
      const versions = await payload.db.findVersions<Event>({
        collection: 'events',
        locale: 'all',
        where: { parent: { equals: id } },
        pagination: false,
      })
      assert.equal(versions.docs.length, 1, `Event ${id} needs exactly one initial version`)
      const { id: _docID, ...data } = doc!
      const { id: _versionID, ...version } = versions.docs[0].version
      const normalized = (value: unknown) =>
        JSON.parse(JSON.stringify(value, (_, field) => (field === undefined ? null : field)))
      assert.deepEqual(
        normalized(version),
        normalized(data),
        `Event ${id} lost localized or nested data in version backfill`,
      )
      assert.equal(data._status, 'published')
      assert.equal(versions.docs[0].latest, true)
    }

    const transactionID = await payload.db.beginTransaction()
    assert.ok(transactionID)
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    const db = sessions[transactionID].db
    try {
      await payload.update({
        collection: 'events',
        id: ids[0].id,
        draft: true,
        data: { title: 'Draft retained by rollback archive' },
        req,
      })
      await down({ db })
      const archived = await db.execute(sql`
        SELECT count(*)::integer AS count FROM cilas_migration_archive.event_versions_20261029
        WHERE source_table = '_events_v_locales'
          AND data->>'version_title' = 'Draft retained by rollback archive'
      `)
      assert.ok(
        Number(archived.rows[0].count) > 0,
        'Rollback failed to archive pending draft content',
      )
      console.log(
        JSON.stringify({
          existingEvents: ids.length,
          localizedVersionParity: true,
          initialVersionsVisible: true,
          rollbackPreservesDraftArchive: true,
        }),
      )
    } finally {
      await payload.db.rollbackTransaction(transactionID)
    }
  }
} finally {
  await payload.destroy()
}
process.exit(0)
