// @vitest-environment node
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/turnstile', async (original) => ({
  ...(await original<typeof import('@/lib/turnstile')>()),
  checkTurnstile: vi.fn(async () => true),
}))

import { submitWithFiles } from '@/forms/submit-with-files'
import { openCoursesInCycle } from '@/forms/open-courses'
import { relId } from '@/lib/relation'
import { TURNSTILE_VERIFIED } from '@/lib/turnstile'
import config from '@/payload.config'
import type { Course, Cycle, Form, FormSubmission, User } from '@/payload-types'
import { createTracker, uniq, uniqEmail } from './fixtures'

const { track, cleanup } = createTracker()
let payload: Payload
let admin: User
let form: Form
let cycle: Cycle
let writing: Course
let film: Course
let own: Course
const email = uniqEmail('cycle-applicant')

const identity = (address = email) => [
  { field: 'name', value: 'Cycle Applicant' },
  { field: 'email', value: address },
]
const choices = (): NonNullable<FormSubmission['choices']> => [
  {
    course: writing.id,
    amount: 100,
    accepted: false,
    answers: [{ name: 'reason', label: 'Untrusted', value: 'To write' }],
  },
  { course: film.id, amount: 100, answers: [] },
]
const request = async (user?: User): Promise<PayloadRequest> => {
  const req = await createLocalReq({ user }, payload)
  req.payloadAPI = 'REST'
  req.context[TURNSTILE_VERIFIED] = true
  return req
}
const submit = async (data: Partial<FormSubmission> = {}) =>
  track(
    'form-submissions',
    await payload.create({
      collection: 'form-submissions',
      data: {
        form: form.id,
        target: { relationTo: 'cycles', value: cycle.id },
        choices: choices(),
        submissionData: identity(),
        ...data,
      },
      req: await request(),
      overrideAccess: false,
      depth: 0,
    }),
  )
const accept = async (id: number) => {
  const endpoints = payload.collections['form-submissions'].config.endpoints
  const endpoint = endpoints && endpoints.find((e) => e.path === '/:id/accept')!
  const req = await createLocalReq({ user: admin }, payload)
  req.routeParams = { id: String(id) }
  if (!endpoint) throw new Error('Accept endpoint missing')
  return endpoint.handler(req)
}
const trackApplicant = async (submission: FormSubmission) => {
  const decided = await payload.findByID({
    collection: 'form-submissions',
    id: submission.id,
    depth: 0,
  })
  const person = relId(decided.result?.person)!
  track('users', relId(decided.result?.user)!)
  track('people', person)
  const enrollments = await payload.find({
    collection: 'enrollments',
    where: { person: { equals: person } },
    depth: 0,
  })
  for (const enrollment of enrollments.docs) track('enrollments', enrollment)
  return { decided, person, enrollments: enrollments.docs }
}

describe('cycle applications and approval', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    admin = track(
      'users',
      await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('cycle-admin'),
          password: 'Test-password-123!',
          roles: ['admin'],
        },
      }),
    )
    form = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: {
          title: uniq('Cycle form'),
          confirmationType: 'redirect',
          redirect: { url: 'https://example.org/thanks' },
        },
      }),
    )
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: uniq('Place'),
          slug: uniq('place'),
          city: uniq('City'),
        },
      }),
    )
    cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: {
          season: 'fall',
          start_year: 2098,
          place: place.id,
          registration: { method: 'form', form: form.id },
          pricing: [
            {
              course_types: ['CORE'],
              pricing: { options: [{ amount: 100, default: true }, { amount: 200 }] },
            },
          ],
        },
      }),
    )
    const createCourse = async (title: string, data: Partial<Course> = {}) =>
      track(
        'courses',
        await payload.create({
          collection: 'courses',
          data: {
            title: uniq(title),
            slug: uniq(title.toLowerCase()),
            course_type: 'CORE',
            session_unit: 'week',
            cycle: cycle.id,
            tier: 'public',
            _status: 'published',
            ...data,
          },
        }),
      )
    writing = await createCourse('Writing', {
      applicant_questions: [
        { blockType: 'text', name: 'reason', label: 'Why writing?', required: true },
      ],
    })
    film = await createCourse('Film')
    own = await createCourse('Own', {
      registration: { mode: 'own', method: 'form', form: form.id },
    })
  })
  afterAll(async () => {
    vi.restoreAllMocks()
    // Required course relationships must be removed before their courses.
    await payload.delete({ collection: 'form-submissions', where: { form: { equals: form.id } } })
    await cleanup(payload)
    await payload.destroy()
  })

  it('lists only eligible courses for the reader, including community for signed-in people', async () => {
    const community = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: uniq('Community'),
          slug: uniq('community'),
          course_type: 'CORE',
          session_unit: 'week',
          cycle: cycle.id,
          tier: 'community',
          _status: 'published',
        },
      }),
    )
    expect((await openCoursesInCycle(payload, cycle.id)).map((c) => c.id).sort()).toEqual(
      [writing.id, film.id].sort(),
    )
    expect((await openCoursesInCycle(payload, cycle.id, admin)).map((c) => c.id).sort()).toEqual(
      [writing.id, film.id, community.id].sort(),
    )
    await payload.update({
      collection: 'courses',
      id: community.id,
      data: { registration: { mode: 'follow_cycle', close_early: '2020-01-01' } },
    })
    expect(
      (await openCoursesInCycle(payload, cycle.id, admin)).some((c) => c.id === community.id),
    ).toBe(false)
  })

  it('saves normalized choices and enrolls only the accepted course, once', async () => {
    const submission = await submit()
    expect(submission.choices).toMatchObject([
      { course: writing.id, accepted: true, answers: [{ label: 'Why writing?' }] },
      { course: film.id, accepted: true },
    ])
    const notifications = await payload.find({
      collection: 'notifications',
      where: { link: { equals: `/admin/collections/form-submissions/${submission.id}` } },
    })
    for (const notification of notifications.docs) track('notifications', notification)
    expect(
      notifications.docs.some(
        (n) => n.description?.includes(writing.title) && n.description.includes(film.title),
      ),
    ).toBe(true)
    await payload.update({
      collection: 'form-submissions',
      id: submission.id,
      data: {
        choices: submission.choices!.map((c) => ({
          ...c,
          accepted: relId(c.course) === writing.id,
        })),
      },
      user: admin,
      overrideAccess: false,
    })
    vi.mocked(payload.sendEmail).mockClear()
    const response = await accept(submission.id)
    expect(response && (await response.json())).toEqual({ ok: true, emailed: true })
    const result = await trackApplicant(submission)
    expect(result.enrollments).toEqual([
      expect.objectContaining({
        course: writing.id,
        status: 'accepted',
        source: 'registration_form',
      }),
    ])
    expect(
      (await payload.findByID({ collection: 'users', id: relId(result.decided.result?.user)! }))
        .roles,
    ).toContain('non_degree_seeking')
    const mail = vi.mocked(payload.sendEmail).mock.calls.at(-1)![0]
    expect(mail.text).toContain(writing.title)
    expect(mail.text).not.toContain(film.title)
    expect((await accept(submission.id))?.status).toBe(200)
    expect(
      (
        await payload.find({
          collection: 'enrollments',
          where: { person: { equals: result.person } },
        })
      ).totalDocs,
    ).toBe(1)
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)

    const again = await submit({ submissionData: identity(email) })
    expect((await accept(again.id))?.status).toBe(200)
    const reused = await trackApplicant(again)
    expect(reused.enrollments.map((e) => e.course).sort()).toEqual([writing.id, film.id].sort())
    expect(reused.person).toBe(result.person)
    const bothMail = vi.mocked(payload.sendEmail).mock.calls.at(-1)![0]
    expect(bothMail.text).toContain(writing.title)
    expect(bothMail.text).toContain(film.title)
  })

  it('refuses invalid choices through the create hook', async () => {
    await expect(submit({ choices: [{ course: own.id, amount: 100 }] })).rejects.toThrow(
      /no longer open/,
    )
    await expect(submit({ choices: [choices()[0], choices()[0]] })).rejects.toThrow(/only once/)
    await expect(submit({ choices: [{ ...choices()[0], answers: [] }] })).rejects.toThrow(
      /Why writing/,
    )
    await expect(submit({ choices: [{ ...choices()[0], amount: 123 }] })).rejects.toThrow(
      /contribution amounts/,
    )
    await expect(submit({ choices: [] })).rejects.toThrow(/at least one/)
    await expect(
      submit({ target: { relationTo: 'courses', value: writing.id }, choices: [] }),
    ).rejects.toThrow(/no longer open/)
  })

  it('still accepts a legacy single-course application with prefixed answers', async () => {
    const submission = track(
      'form-submissions',
      await payload.create({
        collection: 'form-submissions',
        data: {
          form: form.id,
          target: { relationTo: 'courses', value: writing.id },
          submissionData: [
            ...identity(uniqEmail('old-course')),
            { field: 'course_reason', value: 'To write' },
          ],
        },
      }),
    )
    expect(submission.submissionData).toContainEqual(
      expect.objectContaining({ field: 'course_reason', value: 'To write' }),
    )
    expect((await accept(submission.id))?.status).toBe(200)
    expect((await trackApplicant(submission)).enrollments).toEqual([
      expect.objectContaining({ course: writing.id, status: 'accepted' }),
    ])
  })

  it('validates cycle choices in multipart submissions too', async () => {
    const data = new FormData()
    data.set(
      'payload',
      JSON.stringify({
        form: form.id,
        target: { relationTo: 'cycles', value: cycle.id },
        submissionData: identity(uniqEmail('multipart')),
        choices: choices(),
      }),
    )
    const req = await request()
    Object.assign(req, { formData: async () => data })
    const response = await submitWithFiles(req)
    expect(response.status).toBe(201)
    const saved = await payload.find({
      collection: 'form-submissions',
      where: { 'submissionData.value': { equals: uniqEmail('multipart') } },
      depth: 0,
    })
    expect(saved.docs[0].choices?.[0]).toMatchObject({
      course: writing.id,
      accepted: true,
      answers: [{ label: 'Why writing?' }],
    })
    data.set(
      'payload',
      JSON.stringify({
        form: form.id,
        target: { relationTo: 'cycles', value: cycle.id },
        submissionData: identity(),
        choices: [{ course: own.id }],
      }),
    )
    const bad = await submitWithFiles(req)
    expect(bad.status).toBe(400)
    expect(await bad.json()).toHaveProperty(
      'error',
      `${own.title} is no longer open for applications.`,
    )
  })
})
