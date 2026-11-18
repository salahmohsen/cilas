import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { applicantsFor } from '@/forms/applicants'

import { applicationFixture, removeApplicationFixture } from '../../testing/application.fixture'

let f: Awaited<ReturnType<typeof applicationFixture>>
let submission: number
beforeAll(async () => {
  f = await applicationFixture()
  submission = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: [
          { field: 'name', value: 'Applicant' },
          { field: 'email', value: 'applicant@cilas.test' },
          { field: 'shared', value: 'Shared' },
        ],
        choices: [
          {
            course: f.courses[0].id,
            decision: 'pending',
            amount: 900,
            need_reduction: true,
            answers: [{ name: 'reason', value: 'Because' }],
          },
          {
            course: f.courses[1].id,
            decision: 'pending',
            amount: 900,
            need_reduction: true,
            answers: [{ name: 'reason', value: 'Because' }],
          },
        ],
      },
    })
  ).id
})
afterAll(async () => {
  if (f) await removeApplicationFixture(f)
})

describe('applicant data projection', () => {
  it('exposes only the display part of a course cycle', async () => {
    const result = await applicantsFor(f.payload, { kind: 'admin' })
    const application = result.applications.find((a) => a.id === submission)!
    expect(application.choices.map((c) => c.cycle)).toEqual([
      { id: f.cycle.id, title: f.cycle.title },
      { id: f.cycle.id, title: f.cycle.title },
    ])
  })
  it('shows a fellow only the courses they teach', async () => {
    const find = vi.spyOn(f.payload, 'find')
    await applicantsFor(f.payload, { kind: 'fellow', person: 0 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'courses', where: { fellows: { contains: 0 } } }),
    )
    find.mockRestore()
  })
  it('does not query submissions for unauthorized viewers', async () => {
    const find = vi.spyOn(f.payload, 'find')
    expect(await applicantsFor(f.payload, null)).toEqual({ courses: [], applications: [] })
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })
})
