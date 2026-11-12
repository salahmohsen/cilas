// @vitest-environment node
import { createLocalReq } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { courseDeleteSummary } from '@/lib/course-delete'

import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'

let f: Awaited<ReturnType<typeof applicationFixture>>
let course: number
let person: number
let enrollment: number
let only: number
let mixed: number
let event: number

const gone = (collection: 'enrollments' | 'form-submissions', id: number) =>
  f.payload
    .findByID({ collection, id, overrideAccess: true, depth: 0 })
    .then(() => false)
    .catch(() => true)

const identity = (name: string) => [
  { field: 'name', value: name },
  { field: 'email', value: 'applicant@cilas.test' },
  { field: 'shared', value: 'Shared reply' },
]
const choice = (id: number) => ({
  course: id,
  amount: 900,
  decision: 'pending' as const,
  answers: [{ name: 'reason', value: 'Because' }],
})

beforeAll(async () => {
  f = await applicationFixture()
  course = (
    await f.payload.create({
      collection: 'courses',
      data: {
        title: 'Doomed',
        slug: `doomed-${f.suffix}`,
        course_type: 'CORE',
        session_unit: 'week',
        cycle: f.cycle.id,
        tier: 'public',
        registration: { mode: 'follow_cycle' },
        applicant_questions: [{ blockType: 'text', name: 'reason', label: 'Why?' }],
      },
    })
  ).id
  person = (
    await f.payload.create({
      collection: 'people',
      data: { name: 'Enrolled student', slug: `enrolled-${f.suffix}` },
    })
  ).id
  enrollment = (
    await f.payload.create({
      collection: 'enrollments',
      data: { person, course, status: 'accepted' } as never,
      overrideAccess: true,
    })
  ).id
  only = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: identity('Only this course'),
        choices: [choice(course)],
      },
    })
  ).id
  mixed = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: identity('Also another course'),
        choices: [choice(course), choice(f.courses[0].id)],
      },
    })
  ).id
  event = (
    await f.payload.create({
      collection: 'events',
      data: {
        title: `Course session ${f.suffix}`,
        slug: `course-session-${f.suffix}`,
        event_type: 'talk',
        course,
      } as never,
      overrideAccess: true,
    })
  ).id
})

afterAll(async () => {
  if (!f) return
  for (const [collection, id] of [
    ['form-submissions', mixed],
    ['events', event],
    ['people', person],
  ] as const)
    await f.payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
  await removeApplicationFixture(f)
})

describe('deleting a course with dependents', () => {
  it('lists what goes and what loses its link', async () => {
    const req = await createLocalReq({}, f.payload)
    const summary = await courseDeleteSummary(req, course)
    expect(summary.name).toBe('Doomed')
    expect(summary.deletes).toEqual(
      expect.arrayContaining([
        { label: 'enrollments', count: 1, items: ['Enrolled student'] },
        { label: 'applications for this course only', count: 1, items: ['Only this course'] },
      ]),
    )
    expect(summary.unlinks).toEqual(
      expect.arrayContaining([
        {
          label: 'applications that also chose other courses',
          count: 1,
          items: ['Also another course'],
        },
        { label: 'events', count: 1, items: [`Course session ${f.suffix}`] },
      ]),
    )
  })

  it('deletes the course and its dependents, and keeps the other choices', async () => {
    await f.payload.delete({ collection: 'courses', id: course, overrideAccess: true })
    expect(await gone('enrollments', enrollment)).toBe(true)
    expect(await gone('form-submissions', only)).toBe(true)
    const kept = await f.payload.findByID({
      collection: 'form-submissions',
      id: mixed,
      depth: 0,
      overrideAccess: true,
    })
    expect(kept.choices?.map((c) => c.course)).toEqual([f.courses[0].id])
    const unlinked = await f.payload.findByID({
      collection: 'events',
      id: event,
      depth: 0,
      overrideAccess: true,
    })
    expect(unlinked.course ?? null).toBeNull()
  })

  it('closes the stock delete', async () => {
    await expect(
      f.payload.delete({ collection: 'courses', id: f.courses[1].id, overrideAccess: false }),
    ).rejects.toThrow()
  })
})
