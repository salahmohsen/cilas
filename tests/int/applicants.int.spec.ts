// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { applicantsForFellow } from '@/forms/applicants'
import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'
import { handleEndpoints, type TypedUser } from 'payload'

let f: Awaited<ReturnType<typeof applicationFixture>>
let fellow: TypedUser
let admin: TypedUser
let member: TypedUser
let person: number
let mixed: number
let legacy: number
let foreign: number
const users: number[] = []
const password = crypto.randomUUID()
beforeAll(async () => {
  f = await applicationFixture()
  const teacher = await f.payload.create({
    collection: 'people',
    data: { name: 'Applicants teacher', slug: `applicants-${f.suffix}` },
  })
  person = teacher.id
  await f.payload.update({
    collection: 'courses',
    id: f.courses[0].id,
    data: { fellows: [person] },
  })
  for (const role of ['fellow', 'admin'] as const) {
    const user = await f.payload.create({
      collection: 'users',
      data: {
        email: `applicants-${role}-${f.suffix}@cilas.test`,
        password,
        roles: [role],
        ...(role === 'fellow' ? { person } : {}),
      },
    })
    users.push(user.id)
    const typed = { ...user, collection: 'users' as const }
    if (role === 'fellow') fellow = typed
    else if (role === 'admin') admin = typed
  }
  member = { ...fellow, roles: ['member'] }
  const identity = [
    { field: 'name', value: 'Applicant' },
    { field: 'email', value: 'applicant@cilas.test' },
    { field: 'shared', value: 'Shared reply' },
  ]
  const choice = (index: number) => ({
    course: f.courses[index].id,
    amount: 900,
    need_reduction: true,
    accepted: true,
    answers: [{ name: 'reason', value: index ? 'Foreign private answer' : 'Own saved answer' }],
  })
  mixed = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: identity,
        choices: [choice(0), choice(1)],
      },
    })
  ).id
  foreign = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: identity,
        choices: [choice(1)],
      },
    })
  ).id
  legacy = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'courses', value: f.courses[0].id },
        submissionData: [
          ...identity,
          { field: 'course_reason', value: 'Legacy own answer' },
          { field: 'amount', value: 'Secret amount' },
          { field: 'course_amount', value: 'Secret legacy amount' },
        ],
      },
    })
  ).id
  await f.payload.update({
    collection: 'courses',
    id: f.courses[0].id,
    data: {
      applicant_questions: [{ ...f.courses[0].applicant_questions![0], label: 'Changed question' }],
    },
  })
})
afterAll(async () => {
  if (!f) return
  for (const id of users) await f.payload.delete({ collection: 'users', id })
  await f.payload.update({ collection: 'courses', id: f.courses[0].id, data: { fellows: [] } })
  await f.payload.delete({ collection: 'people', id: person })
  await removeApplicationFixture(f)
})
describe('fellow applicants projection', () => {
  it('returns only taught choices and saved answers, with legacy applications and course counts', async () => {
    const result = await applicantsForFellow(f.payload, fellow)
    expect(result.courses).toEqual([{ id: f.courses[0].id, title: 'Writing', count: 2 }])
    expect(result.applications.map((a) => a.id).sort()).toEqual([mixed, legacy].sort())
    const application = result.applications.find((a) => a.id === mixed)!
    expect(application).toMatchObject({
      name: 'Applicant',
      email: 'applicant@cilas.test',
      status: 'new',
      answers: expect.arrayContaining([{ label: 'Your interests', value: 'Shared reply' }]),
      choices: [
        {
          course: f.courses[0].id,
          title: 'Writing',
          accepted: true,
          answers: [{ label: 'Why writing?', value: 'Own saved answer' }],
        },
      ],
    })
    expect(application.submitted).toMatch(/^\d{4}-/)
    const serialized = JSON.stringify(result)
    for (const secret of [
      'Foreign private answer',
      'Film',
      'amount',
      'need_reduction',
      'Secret amount',
      'Secret legacy amount',
    ])
      expect(serialized).not.toContain(secret)
    expect(result.applications.find((a) => a.id === legacy)?.choices[0].answers).toContainEqual({
      label: 'Changed question',
      value: 'Legacy own answer',
    })
  })
  it('gives admins all courses, choices and financial fields', async () => {
    const result = await applicantsForFellow(f.payload, admin)
    expect(result.applications.find((a) => a.id === foreign)).toBeDefined()
    expect(result.applications.find((a) => a.id === mixed)?.choices).toMatchObject([
      { amount: 900, need_reduction: true },
      { amount: 900, need_reduction: true },
    ])
    expect(result.courses.find((c) => c.id === f.courses[1].id)?.count).toBe(2)
  })
  it('returns nothing for members, anonymous users and unlinked fellows', async () => {
    for (const user of [member, undefined, { ...fellow, person: null }])
      expect(await applicantsForFellow(f.payload, user)).toEqual({ courses: [], applications: [] })
  })
  it('refuses an authenticated fellow through the REST handler', async () => {
    const login = await f.payload.login({
      collection: 'users',
      data: { email: fellow.email, password },
    })
    const response = await handleEndpoints({
      config: f.payload.config,
      path: '/api/form-submissions',
      request: new Request('http://localhost:3000/api/form-submissions', {
        headers: { Authorization: `JWT ${login.token}` },
      }),
    })
    expect(response.status).toBe(403)
    expect(await response.json()).not.toHaveProperty('docs')
  })
  it('keeps form-submissions inaccessible through the Local API with access enforced', async () => {
    await expect(
      f.payload.find({ collection: 'form-submissions', user: fellow, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      f.payload.findByID({
        collection: 'form-submissions',
        id: mixed,
        user: fellow,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
