// @vitest-environment node
import { createLocalReq } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { expect, it } from 'vitest'
import { up } from '@/migrations/20261110_182457_backfill_course_choices'
import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'

it('moves only legacy course answers, snapshots labels and preserves existing choices and other targets', async () => {
  const f = await applicationFixture()
  const ids: number[] = []
  for (let i = 0; i < 4; i++) {
    ids.push(
      (
        await f.payload.create({
          collection: 'form-submissions',
          data: {
            form: f.form.id,
            submissionData: [
              { field: 'name', value: 'Historical applicant' },
              { field: 'course_reason', value: 'Historical reason' },
              { field: 'course_removed', value: 'Removed question answer' },
            ],
          },
        })
      ).id,
    )
  }
  const transactionID = await f.payload.db.beginTransaction()
  if (!transactionID) throw new Error('Migration test requires a transaction')
  const db = (f.payload.db.sessions as PostgresAdapter['sessions'])[transactionID].db
  const req = await createLocalReq({}, f.payload)
  req.transactionID = transactionID
  try {
    for (const id of ids.slice(0, 3)) {
      await db.execute(sql`INSERT INTO form_submissions_rels(parent_id, path, courses_id)
        VALUES (${id}, 'target', ${f.courses[0].id})`)
    }
    await db.execute(sql`INSERT INTO form_submissions_choices(_order, _parent_id, id, course_id, amount, accepted)
      VALUES (1, ${ids[2]}, 'existing-choice', ${f.courses[1].id}, 350, false)`)
    await db.execute(
      sql`DELETE FROM form_submissions_submission_data WHERE _parent_id = ${ids[1]} AND starts_with(field, 'course_')`,
    )
    const read = (id: number) =>
      f.payload.findByID({ collection: 'form-submissions', id, depth: 0, req })
    expect((await read(ids[0])).choices).toEqual([])
    await up({ db, payload: f.payload, req })
    for (let pass = 0; pass < 2; pass++) {
      const migrated = await read(ids[0])
      expect(migrated.choices).toEqual([
        expect.objectContaining({
          course: f.courses[0].id,
          accepted: true,
          answers: [
            expect.objectContaining({
              name: 'reason',
              label: 'Why writing?',
              value: 'Historical reason',
            }),
            expect.objectContaining({
              name: 'removed',
              label: 'removed',
              value: 'Removed question answer',
            }),
          ],
        }),
      ])
      expect(migrated.submissionData).toEqual([
        expect.objectContaining({ field: 'name', value: 'Historical applicant' }),
      ])
      expect((await read(ids[1])).choices).toEqual([
        expect.objectContaining({ course: f.courses[0].id, accepted: true, answers: [] }),
      ])
      expect((await read(ids[2])).choices).toEqual([
        expect.objectContaining({
          id: 'existing-choice',
          course: f.courses[1].id,
          amount: 350,
          accepted: false,
        }),
      ])
      expect((await read(ids[2])).submissionData).toHaveLength(3)
      expect((await read(ids[3])).choices).toEqual([])
      expect((await read(ids[3])).submissionData).toHaveLength(3)
      if (pass === 0) await up({ db, payload: f.payload, req })
    }
  } finally {
    await f.payload.db.rollbackTransaction(transactionID)
    await removeApplicationFixture(f)
  }
})
