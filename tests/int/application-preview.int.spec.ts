// @vitest-environment node
import { createLocalReq } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'
import { fullFormPreview } from '@/forms/preview-context'
import { submissionChoices } from '@/forms/submission-view'
import type { User } from '@/payload-types'

const admin = { id: -1, collection: 'users', roles: ['admin'] } as User
let fixture: Awaited<ReturnType<typeof applicationFixture>>

describe('application preview and review data', () => {
  beforeAll(async () => {
    fixture = await applicationFixture()
  })
  afterAll(async () => {
    if (fixture) await removeApplicationFixture(fixture)
  })

  it('uses only open follow-cycle courses and localizes their questions', async () => {
    const { payload, cycle, courses } = fixture
    await payload.update({
      collection: 'courses',
      id: courses[1].id,
      data: { registration: { mode: 'closed' } },
    })
    const preview = await fullFormPreview(payload, admin, 'cycles', cycle.id, 'ar')
    expect(preview?.application.courses).toMatchObject([
      { id: courses[0].id, title: 'الكتابة', questions: [{ label: 'لماذا الكتابة؟' }] },
    ])
    expect(preview?.application.courses).toHaveLength(1)
    expect(preview?.application.initialCourse).toBeUndefined()
    await payload.update({
      collection: 'courses',
      id: courses[1].id,
      data: { registration: { mode: 'own', method: 'form', form: fixture.form.id } },
    })
    const cyclePreview = await fullFormPreview(payload, admin, 'cycles', cycle.id, 'en')
    expect(cyclePreview?.application.courses.map((c) => c.id)).toEqual([courses[0].id])
    const own = await fullFormPreview(payload, admin, 'courses', courses[1].id, 'en')
    expect(own?.application).toMatchObject({
      selectable: false,
      initialCourse: courses[1].id,
      courses: [{ id: courses[1].id }],
    })
    const follow = await fullFormPreview(payload, admin, 'courses', courses[0].id, 'en')
    expect(follow?.application.initialCourse).toBe(courses[0].id)
  })

  it.each([null, ['member'], ['fellow']])('refuses full preview for %j', async (roles) => {
    const user = roles ? ({ ...admin, roles } as User) : null
    expect(
      await fullFormPreview(fixture.payload, user, 'cycles', fixture.cycle.id, 'en'),
    ).toBeNull()
    expect(
      await fullFormPreview(fixture.payload, user, 'courses', fixture.courses[0].id, 'en'),
    ).toBeNull()
  })

  it('shows saved labels, values and contributions with a course link', async () => {
    const { payload, form, cycle, courses } = fixture
    const saved = await payload.create({
      collection: 'form-submissions',
      data: {
        form: form.id,
        target: { relationTo: 'cycles', value: cycle.id },
        submissionData: [
          { field: 'name', value: 'Review applicant' },
          { field: 'email', value: `review-${fixture.suffix}@cilas.test` },
        ],
        choices: [
          {
            course: courses[0].id,
            amount: 350,
            need_reduction: true,
            answers: [{ name: 'reason', value: 'To write' }],
          },
        ],
      },
    })
    await payload.update({
      collection: 'courses',
      id: courses[0].id,
      data: {
        applicant_questions: [{ ...courses[0].applicant_questions![0], label: 'Changed question' }],
      },
    })
    const view = await submissionChoices(await createLocalReq({}, payload), saved.choices)
    expect(view).toMatchObject([
      {
        title: 'Writing',
        href: `/admin/collections/courses/${courses[0].id}`,
        amount: 350,
        need_reduction: true,
        accepted: true,
        answers: [{ label: 'Why writing?', value: 'To write' }],
      },
    ])
    const filtered = await payload.find({
      collection: 'form-submissions',
      where: {
        and: [{ form: { equals: form.id } }, { 'choices.course': { equals: courses[0].id } }],
      },
      depth: 0,
    })
    expect(filtered.docs.map((s) => s.id)).toEqual([saved.id])
    expect(filtered.docs[0].courses).toBe('Writing')
  })
})
