// @vitest-environment node
import { createLocalReq } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { expect, it } from 'vitest'
import { up, down } from '@/migrations/20261110_180434_application_enrollment_results'
import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'

it('copies old single-course and JSON results into relationships and typed outcomes without duplicate links', async () => {
  const f = await applicationFixture()
  const person = await f.payload.create({
    collection: 'people',
    data: { name: 'Migration applicant', slug: `migration-${f.suffix}` },
  })
  const enrollment = await f.payload.create({
    collection: 'enrollments',
    data: {
      person: person.id,
      course: f.courses[0].id,
      status: 'accepted',
      source: 'registration_form',
    },
  })
  const submission = await f.payload.create({
    collection: 'form-submissions',
    data: {
      form: f.form.id,
      target: { relationTo: 'courses', value: f.courses[0].id },
      submissionData: [
        { field: 'name', value: 'Migration applicant' },
        { field: 'email', value: 'migration@cilas.test' },
      ],
    },
  })
  const transactionID = await f.payload.db.beginTransaction()
  if (!transactionID) throw new Error('Migration test requires a transaction')
  const db = (f.payload.db.sessions as PostgresAdapter['sessions'])[transactionID].db
  const req = await createLocalReq({}, f.payload)
  req.transactionID = transactionID
  try {
    await down({ db, payload: f.payload, req })
    await db.execute(
      sql`UPDATE form_submissions SET result_enrollment_id = ${enrollment.id} WHERE id = ${submission.id}`,
    )
    await up({ db, payload: f.payload, req })
    const legacy = await f.payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
      req,
    })
    expect(legacy.result?.enrollments).toEqual([enrollment.id])
    expect(legacy.result?.enrollment_outcomes).toEqual([])
    await down({ db, payload: f.payload, req })
    const results = JSON.stringify([
      { course: f.courses[0].id, title: 'Old title', enrollment: enrollment.id, created: false },
    ])
    await db.execute(
      sql`UPDATE form_submissions SET result_enrollments = ${results}::jsonb WHERE id = ${submission.id}`,
    )
    await up({ db, payload: f.payload, req })
    const migrated = await f.payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
      req,
    })
    expect(migrated.result?.enrollments).toEqual([enrollment.id])
    expect(migrated.result?.enrollment_outcomes).toEqual([
      expect.objectContaining({ enrollment: enrollment.id, created: false }),
    ])
  } finally {
    await f.payload.db.rollbackTransaction(transactionID)
    await f.payload.delete({ collection: 'enrollments', id: enrollment.id })
    await f.payload.delete({ collection: 'people', id: person.id })
    await removeApplicationFixture(f)
  }
})
