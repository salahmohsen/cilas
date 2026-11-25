import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scratchPayload } from '../../../testing/scratch-database.test-utils'

describe('review-events: migrations', () => {
  let scratch: Awaited<ReturnType<typeof scratchPayload>>

  beforeAll(async () => {
    scratch = await scratchPayload()
  })

  afterAll(async () => {
    await scratch?.destroy()
  })

  it('withdrawn is a value of enum_notifications_kind', async () => {
    const { rows } = await scratch.payload.db.pool.query<{ value: string }>(
      'select unnest(enum_range(null::enum_notifications_kind))::text as value',
    )
    expect(rows.map(({ value }) => value)).toContain('withdrawn')
  })

  it('the review_events table exists with its indexes and actor foreign key', async () => {
    const { pool } = scratch.payload.db
    const { rows: columns } = await pool.query(
      `select column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema = 'public' and table_name = 'review_events'`,
    )
    expect(columns).toEqual(expect.arrayContaining([
      { column_name: 'doc', data_type: 'numeric', is_nullable: 'NO' },
      { column_name: 'version', data_type: 'numeric', is_nullable: 'YES' },
      { column_name: 'actor_id', data_type: 'integer', is_nullable: 'YES' },
    ]))

    const { rows: indexes } = await pool.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'review_events'",
    )
    expect(indexes.map(({ indexdef }) => indexdef)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\(collection, doc\)$/),
      expect.stringMatching(/\(doc\)$/),
    ]))

    const { rows: foreignKeys } = await pool.query(
      `select confdeltype, pg_get_constraintdef(oid) as definition
       from pg_constraint where conrelid = 'public.review_events'::regclass and contype = 'f'`,
    )
    expect(foreignKeys).toContainEqual({
      confdeltype: 'n',
      definition: expect.stringMatching(/^FOREIGN KEY \(actor_id\) REFERENCES users\(id\)/),
    })
  })
})
