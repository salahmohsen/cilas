import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applicantsFor, applicantViewer, countWaitingApplicants } from '@/forms/applicants'
import { applicationFixture, removeApplicationFixture } from '../../testing/application.fixture'
import { recordingPayload } from '../../testing/needs.fixture'
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
    { field: 'payment_interests', value: 'Ordinary shared answer' },
  ]
  const choice = (index: number) => ({
    course: f.courses[index].id,
    amount: 900,
    need_reduction: true,
    decision: 'pending' as const,
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
        choices: [
          {
            course: f.courses[0].id,
            amount: 900,
            answers: [{ name: 'reason', value: 'Legacy own answer' }],
          },
        ],
        submissionData: [...identity],
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
  it('returns only taught choices and saved answers, with course applications and course counts', async () => {
    const result = await applicantsFor(f.payload, applicantViewer(fellow))
    expect(result.courses).toEqual([{ id: f.courses[0].id, title: 'Writing', count: 2 }])
    expect(result.applications.map((a) => a.id).sort()).toEqual([mixed, legacy].sort())
    const application = result.applications.find((a) => a.id === mixed)!
    expect(application).toMatchObject({
      name: 'Applicant',
      email: 'applicant@cilas.test',
      status: 'new',
      answers: expect.arrayContaining([
        { name: 'shared', label: 'Your interests', value: 'Shared reply' },
        { name: 'payment_interests', label: 'payment_interests', value: 'Ordinary shared answer' },
      ]),
      choices: [
        {
          course: f.courses[0].id,
          title: 'Writing',
          decision: 'pending',
          answers: [{ name: 'reason', label: 'Why writing?', value: 'Own saved answer' }],
        },
      ],
    })
    expect(application.submitted).toMatch(/^\d{4}-/)
    for (const a of result.applications) {
      for (const c of a.choices) {
        expect(Object.keys(c).sort()).toEqual([
          'answers',
          'contribution',
          'course',
          'cover',
          'cycle',
          'decided',
          'decision',
          'emailFailed',
          'fields',
          'title',
        ])
        expect(c.course).toBe(f.courses[0].id)
      }
    }
    expect(result.applications.find((a) => a.id === legacy)?.choices[0].answers).toContainEqual({
      name: 'reason',
      label: 'Why writing?',
      value: 'Legacy own answer',
    })
  })
  it('gives admins all courses, choices and financial fields', async () => {
    const result = await applicantsFor(f.payload, applicantViewer(admin))
    expect(result.applications.find((a) => a.id === foreign)).toBeDefined()
    expect(result.applications.find((a) => a.id === mixed)?.choices).toMatchObject([
      { amount: 900, need_reduction: true },
      { amount: 900, need_reduction: true },
    ])
    expect(result.courses.find((c) => c.id === f.courses[1].id)?.count).toBe(2)
  })
  it('returns nothing for members, anonymous users and unlinked fellows', async () => {
    for (const user of [member, undefined, { ...fellow, person: null }])
      expect(await applicantsFor(f.payload, applicantViewer(user))).toEqual({
        courses: [],
        applications: [],
      })
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

describe('countWaitingApplicants', () => {
  let teacher: TypedUser
  let teacherUser: number
  let teacherPerson: number

  beforeAll(async () => {
    const created = await f.payload.create({
      collection: 'people',
      data: { name: 'Count teacher', slug: `count-teacher-${f.suffix}` },
    })
    teacherPerson = created.id
    const user = await f.payload.create({
      collection: 'users',
      data: {
        email: `count-teacher-${f.suffix}@cilas.test`,
        password,
        roles: ['fellow'],
        person: teacherPerson,
      },
    })
    teacherUser = user.id
    teacher = { ...user, collection: 'users' as const }
    await f.payload.update({
      collection: 'courses',
      id: f.courses[0].id,
      data: { fellows: [person, teacherPerson] },
    })
    await f.payload.update({
      collection: 'courses',
      id: f.courses[1].id,
      data: { fellows: [teacherPerson] },
    })
  })

  afterAll(async () => {
    await f.payload.update({
      collection: 'courses',
      id: f.courses[0].id,
      data: { fellows: [person] },
    })
    await f.payload.update({ collection: 'courses', id: f.courses[1].id, data: { fellows: [] } })
    await f.payload.delete({ collection: 'users', id: teacherUser })
    await f.payload.delete({ collection: 'people', id: teacherPerson })
  })

  const applyTo = async (choices: Array<{ course: number; decision?: string | null }>) => {
    const created = await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: [
          { field: 'name', value: 'Counted' },
          { field: 'email', value: 'counted@cilas.test' },
        ],
        choices: choices.map(({ course }) => ({
          course,
          amount: 900,
          answers: [{ name: 'reason', value: 'Counted answer' }],
        })),
      } as never,
    })
    await f.payload.update({
      collection: 'form-submissions',
      id: created.id,
      data: {
        choices: (created.choices ?? []).map((choice, index) => ({
          ...choice,
          decision: choices[index]!.decision,
        })),
      } as never,
    })
    return created.id
  }

  const waiting = async (user: TypedUser) => (await countWaitingApplicants(f.payload, user)).total

  it('counts 2 for one applicant with two waiting course choices', async () => {
    const before = await waiting(teacher)
    await applyTo([
      { course: f.courses[0].id, decision: 'pending' },
      { course: f.courses[1].id, decision: 'pending' },
    ])
    expect(await waiting(teacher)).toBe(before + 2)
  })

  it('counts 0 for a programme application', async () => {
    const programme = await f.payload.create({
      collection: 'programmes',
      data: {
        title: `Count programme ${f.suffix}`,
        slug: `count-programme-${f.suffix}`,
        kind: 'residency',
        registration: { method: 'form', form: f.form.id },
      },
    })
    const before = await waiting(teacher)
    const submission = await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'programmes', value: programme.id },
        submissionData: [
          { field: 'name', value: 'Counted' },
          { field: 'email', value: 'counted@cilas.test' },
        ],
      },
    })
    try {
      expect(await waiting(teacher)).toBe(before)
    } finally {
      await f.payload.delete({ collection: 'form-submissions', id: submission.id })
      await f.payload.delete({ collection: 'programmes', id: programme.id })
    }
  })

  it('counts a null decision as waiting', async () => {
    const before = await waiting(teacher)
    await applyTo([{ course: f.courses[0].id, decision: null }])
    expect(await waiting(teacher)).toBe(before + 1)
  })

  it('an accepted choice does not count', async () => {
    const before = await waiting(teacher)
    await applyTo([{ course: f.courses[0].id, decision: 'accepted' }])
    expect(await waiting(teacher)).toBe(before)
  })

  it('a submission whose choices are all decided is not read', async () => {
    const decided = await applyTo([
      { course: f.courses[0].id, decision: 'accepted' },
      { course: f.courses[1].id, decision: 'rejected' },
    ])
    const { payload, calls } = recordingPayload(f.payload)
    await countWaitingApplicants(payload, teacher)
    const read = calls.find((call) => call.args.collection === 'form-submissions')!
    const docs = (read.result as { docs: Array<{ id: number }> }).docs
    expect(docs.map((doc) => doc.id)).not.toContain(decided)
  })

  it('a fellow counts only the courses they teach', async () => {
    const before = await waiting(fellow)
    await applyTo([{ course: f.courses[1].id, decision: 'pending' }])
    expect(await waiting(fellow)).toBe(before)
    await applyTo([{ course: f.courses[0].id, decision: 'pending' }])
    expect(await waiting(fellow)).toBe(before + 1)
  })

  it('a student counts 0 and runs no query', async () => {
    const { payload, calls } = recordingPayload(f.payload)
    expect(await countWaitingApplicants(payload, member)).toEqual({ total: 0 })
    expect(calls).toHaveLength(0)
  })
})
