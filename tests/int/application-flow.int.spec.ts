// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { TURNSTILE_VERIFIED } from '@/lib/turnstile'
import type { Course, Form, FormSubmission, Person, User } from '@/payload-types'

type Tracked =
  | 'forms'
  | 'form-submissions'
  | 'courses'
  | 'cycles'
  | 'places'
  | 'people'
  | 'users'
  | 'enrollments'
  | 'memberships'
const created: Array<{ collection: Tracked; id: number }> = []
const track = <T extends { id: number }>(collection: Tracked, doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

let payload: Payload
let admin: User
let fellow: User
let fellowPerson: Person
let member: User
let memberPerson: Person
let form: Form
let course: Course
const RUN = randomBytes(3).toString('hex')
const APPLICANT_EMAIL = `flow-applicant-${RUN}@cilas.test`
const MEMBER_EMAIL = `flow-member-${RUN}@cilas.test`
const ADMIN_EMAIL = `flow-admin-${RUN}@cilas.test`
const FELLOW_EMAIL = `flow-fellow-${RUN}@cilas.test`
const personSlug = (name: string) => `${name.replace(/\s+/g, '-').toLowerCase()}-${RUN}`

const thanks = {
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Thanks',
            format: 0,
            mode: 'normal',
            style: '',
            detail: 0,
          },
        ],
      },
    ],
  },
} as never

const submit = (email: string, data: { field: string; value: string }[]) =>
  payload.create({
    collection: 'form-submissions',
    data: {
      form: form.id,
      target: { relationTo: 'courses', value: course.id },
      choices: [
        {
          course: course.id,
          answers: data.map((a) => ({ name: a.field, value: a.value })),
        },
      ],
      submissionData: [
        { field: 'name', value: 'Mona Farid' },
        { field: 'email', value: email },
      ],
    },
  })

/** Creates as the site's REST API would, so boundary hooks cannot skip it.
 * The Turnstile context marks it the way the files endpoint marks its own
 * submission: the spam check already ran where the request came from. */
const restCreate = async (
  email: string,
  data: { field: string; value: string }[] = [{ field: 'track', value: 'Film' }],
): Promise<FormSubmission> => {
  const req = await createLocalReq({ user: undefined }, payload)
  ;(req as { payloadAPI?: string }).payloadAPI = 'REST'
  return payload.create({
    collection: 'form-submissions',
    data: {
      form: form.id,
      target: { relationTo: 'courses', value: course.id },
      choices: [
        {
          course: course.id,
          answers: data.map((a) => ({ name: a.field, value: a.value })),
        },
      ],
      submissionData: [
        { field: 'name', value: 'Mona Farid' },
        { field: 'email', value: email },
      ],
    },
    context: { [TURNSTILE_VERIFIED]: true },
    req,
  } as never) as unknown as FormSubmission
}

/** One course's decision when `courseId` is given, the whole submission's (programmes) otherwise. */
const decide = async (
  action: 'accept' | 'reject' | 'reopen' | 'resend',
  id: number,
  courseId?: number,
) => {
  const path = courseId ? `/:id/courses/:course/${action}` : `/:id/${action}`
  const endpoint = (
    payload.collections['form-submissions'].config.endpoints as {
      path: string
      handler: (req: never) => Promise<Response>
    }[]
  ).find((e) => e.path === path)!
  const req = await createLocalReq({ user: admin }, payload)
  req.routeParams = { id: String(id), ...(courseId ? { course: String(courseId) } : {}) }
  return endpoint.handler(req as never)
}

const cleanup = async () => {
  for (const { collection, id } of created.reverse()) {
    if (collection === 'users') {
      const person = await payload
        .findByID({ collection: 'users', id, overrideAccess: true })
        .then((u) => (typeof u.person === 'object' ? u.person?.id : u.person))
        .catch(() => undefined)
      await payload.delete({ collection, id }).catch(() => undefined)
      if (person) await payload.delete({ collection: 'people', id: person }).catch(() => undefined)
      continue
    }
    if (collection === 'people') continue // deleted with their account
    await payload.delete({ collection, id }).catch(() => undefined)
  }
}

describe('the application flow, from the questions to the enrollment', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    await payload
      .delete({
        collection: 'users',
        where: { email: { in: [APPLICANT_EMAIL, MEMBER_EMAIL, ADMIN_EMAIL, FELLOW_EMAIL] } },
      })
      .catch(() => undefined)
    admin = await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: 'probe-password-1', roles: ['admin'] },
    })
    // A fellow account with its person: teaching is own-owned through it.
    fellow = await payload.create({
      collection: 'users',
      data: { email: FELLOW_EMAIL, password: 'probe-password-1', roles: ['fellow'] },
    })
    track('users', fellow as unknown as { id: number })
    fellowPerson = await payload.create({
      collection: 'people',
      data: { name: 'Fellow Probe', slug: personSlug('fellow-probe'), visible: false },
    })
    await payload.update({ collection: 'users', id: fellow.id, data: { person: fellowPerson.id } })
    member = await payload.create({
      collection: 'users',
      data: { email: MEMBER_EMAIL, password: 'probe-password-1', roles: ['member'] },
    })
    track('users', member as unknown as { id: number })
    memberPerson = await payload.create({
      collection: 'people',
      data: { name: 'Member Probe', slug: personSlug('member-probe'), visible: false },
    })
    await payload.update({ collection: 'users', id: member.id, data: { person: memberPerson.id } })

    const place = await payload.create({
      collection: 'places',
      data: { name: 'Flow Place', slug: `flow-place-${RUN}`, city: 'Probeville' },
      overrideAccess: true,
    })
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
      overrideAccess: true,
    })
    track('places', place as unknown as { id: number })
    track('cycles', cycle as unknown as { id: number })
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup()
    await payload.destroy()
  })

  it('the fellow builds the course with application questions, one a dropdown', async () => {
    const req = await createLocalReq({ user: fellow }, payload)
    course = (await payload.create({
      collection: 'courses',
      data: {
        title: 'Flow Course',
        slug: `flow-course-${RUN}`,
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'owner',
        cycle: cycleId(),
        applicant_questions: [
          {
            blockType: 'select',
            name: 'track',
            label: 'Track',
            placeholder: 'Pick a track',
            required: true,
            options: [
              { label: 'Anthropology', value: 'anthro' },
              { label: 'Film', value: 'film' },
            ],
          },
          { blockType: 'number', name: 'years', label: 'Years of practice' },
        ],
        schedule: {
          start_date: '2031-03-04',
          weeks: 1,
          slots: [{ weekday: 'tue', start_time: '18:00', end_time: '20:00' }],
        },
        sessions: [{ order: 1 }],
      } as never,
      req,
    } as never)) as unknown as Course
    track('courses', course as unknown as { id: number })

    const questions = course.applicant_questions ?? []
    expect(questions.map((q) => q.blockType)).toEqual(['select', 'number'])
    expect((questions[0] as { options?: { label: string }[] }).options?.at(-1)?.label).toBe('Film')
  })

  it('the admin form always carries name and email, and they cannot be removed', async () => {
    form = (await payload.create({
      collection: 'forms',
      data: { title: 'Flow application', confirmationType: 'message', confirmationMessage: thanks },
      overrideAccess: true,
    })) as unknown as Form
    track('forms', form)

    const first = form.fields ?? []
    expect(first.map((b) => [b.blockType, (b as { name?: string }).name])).toEqual([
      ['text', 'name'],
      ['email', 'email'],
    ])
    expect(first.every((b) => (b as { required?: boolean }).required === true)).toBe(true)

    const renamed = (await payload.update({
      collection: 'forms',
      id: form.id,
      data: {
        fields: [
          {
            blockType: 'select',
            name: 'track',
            label: 'Track',
            options: [{ label: 'A', value: 'a' }],
          },
        ] as never,
      },
      overrideAccess: true,
    })) as unknown as Form
    const after = (renamed.fields ?? []).map((b) => (b as { name?: string }).name ?? 'message')
    expect(after.slice(0, 2)).toEqual(['name', 'email'])
    expect(after.length).toBe(3)

    await payload.update({
      collection: 'courses',
      id: course.id,
      // Applications go only to a course that is on the site.
      data: { registration: { mode: 'own', method: 'form', form: form.id }, _status: 'published' },
      overrideAccess: true,
    })
  })

  it('an anonymous applicant applies; the acceptance makes the account and enrolls', async () => {
    const submission = await submit(APPLICANT_EMAIL, [
      { field: 'track', value: 'Anthropology' }, // the label selects it on site
      { field: 'years', value: '3' },
    ])
    track('form-submissions', submission)
    expect(submission.status).toBe('new')

    const res = await decide('accept', submission.id, course.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      emailed: true,
      decided: expect.stringMatching(/^\d{4}-/),
    })

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: APPLICANT_EMAIL } },
      depth: 1,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0].roles).toEqual(['non_degree_seeking'])
    const person = docs[0].person as { id: number; name: string; visible: boolean } | null
    expect(person?.name).toBe('Mona Farid')
    expect(person?.visible).toBe(false)

    const enrollments = await payload.find({
      collection: 'enrollments',
      where: { person: { equals: person!.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(enrollments.docs).toEqual([
      expect.objectContaining({
        course: course.id,
        status: 'accepted',
        source: 'registration_form',
      }),
    ])
    track('enrollments', enrollments.docs[0] as unknown as { id: number })

    const decided = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(decided.status).toBe('accepted')
    expect(decided.choices?.[0]).toMatchObject({ decision: 'accepted' })
    expect(decided.choices?.[0]?.decided_at).toBe(decided.decided_at)
    expect(decided.result).toEqual({
      user: docs[0].id,
      person: person!.id,
      membership: null,
      enrollments: [enrollments.docs[0].id],
      enrollment_outcomes: [
        expect.objectContaining({ enrollment: enrollments.docs[0].id, created: true }),
      ],
    })
    expect(payload.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: APPLICANT_EMAIL }))
  })

  it('a signed-in member keeps their account, gains no second role, and gets the enrollment', async () => {
    const before = await payload.find({
      collection: 'users',
      where: { email: { equals: MEMBER_EMAIL } },
    })
    const submission = await submit(MEMBER_EMAIL.toUpperCase(), [
      { field: 'track', value: 'Film' },
      { field: 'years', value: '1' },
    ])
    track('form-submissions', submission)

    const res = await decide('accept', submission.id, course.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, emailed: true })

    const after = await payload.find({
      collection: 'users',
      where: { email: { equals: MEMBER_EMAIL } },
      depth: 1,
    })
    expect(after.docs).toHaveLength(before.totalDocs)
    expect(after.docs[0].roles).toEqual(['member'])
    const person = after.docs[0].person as { id: number }
    expect(person.id).toBe(memberPerson.id)

    const enrollments = await payload.find({
      collection: 'enrollments',
      where: { person: { equals: memberPerson.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(enrollments.docs).toHaveLength(1)
    expect(enrollments.docs[0]).toEqual(
      expect.objectContaining({ course: course.id, status: 'accepted' }),
    )
    track('enrollments', enrollments.docs[0] as unknown as { id: number })
  })

  it('an admin rejects a course once, and the applicant gets a kind email and no account', async () => {
    const address = `rejected-${RUN}@cilas.test`
    const submission = await submit(address, [{ field: 'track', value: 'Film' }])
    track('form-submissions', submission)
    vi.mocked(payload.sendEmail).mockClear()
    const res = await decide('reject', submission.id, course.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, emailed: true })
    const rejected = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      overrideAccess: true,
    })
    expect(rejected.status).toBe('rejected')
    expect(rejected.decided_at).toBeTruthy()
    expect(rejected.choices?.[0]).toMatchObject({ decision: 'rejected' })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: address, subject: 'Your application to Flow Course' }),
    )
    const users = await payload.find({ collection: 'users', where: { email: { equals: address } } })
    expect(users.totalDocs).toBe(0)

    expect((await decide('reject', submission.id, course.id)).status).toBe(400)
    expect((await decide('accept', submission.id, course.id)).status).toBe(400)
  })

  it('decides the courses of one application on their own; the status follows the last decision', async () => {
    const address = `two-${RUN}@cilas.test`
    const other = track(
      'courses',
      (await payload.create({
        collection: 'courses',
        data: {
          title: 'Second Flow Course',
          slug: `flow-second-${RUN}`,
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'owner',
          cycle: cycleId(),
          schedule: { start_date: '2031-03-04', weeks: 1, slots: [] },
          sessions: [{ order: 1 }],
        } as never,
        overrideAccess: true,
      })) as unknown as Course,
    )
    await payload.update({
      collection: 'cycles',
      id: cycleId(),
      data: { registration: { method: 'form', form: form.id } },
      overrideAccess: true,
    })
    const submission = track(
      'form-submissions',
      (await payload.create({
        collection: 'form-submissions',
        data: {
          form: form.id,
          target: { relationTo: 'cycles', value: cycleId() },
          choices: [
            { course: course.id, answers: [{ name: 'track', value: 'Film' }] },
            { course: other.id, answers: [] },
          ],
          submissionData: [
            { field: 'name', value: 'Mona Farid' },
            { field: 'email', value: address },
          ],
        },
        context: { [TURNSTILE_VERIFIED]: true },
      } as never)) as unknown as FormSubmission,
    )
    const read = () =>
      payload.findByID({ collection: 'form-submissions', id: submission.id, overrideAccess: true })
    vi.mocked(payload.sendEmail).mockClear()

    // A course application is not decided as a whole.
    expect((await decide('accept', submission.id)).status).toBe(400)

    expect((await decide('accept', submission.id, course.id)).status).toBe(200)
    let now = await read()
    expect(now.status).toBe('new')
    expect(now.decided_at).toBeNull()
    expect(now.choices?.map((c) => c.decision)).toEqual(['accepted', 'pending'])
    expect(payload.sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: address, subject: 'You are accepted to Flow Course' }),
    )
    const user = (
      await payload.find({ collection: 'users', where: { email: { equals: address } }, depth: 0 })
    ).docs[0]!
    track('users', user as unknown as { id: number })
    const enrolled = () =>
      payload.find({
        collection: 'enrollments',
        where: { person: { equals: user.person } },
        depth: 0,
        overrideAccess: true,
      })
    const first = await enrolled()
    expect(first.docs.map((e) => e.course)).toEqual([course.id])
    first.docs.forEach((e) => track('enrollments', e))

    expect((await decide('reject', submission.id, other.id)).status).toBe(200)
    now = await read()
    expect(now.status).toBe('accepted')
    expect(now.choices?.map((c) => c.decision)).toEqual(['accepted', 'rejected'])
    expect(now.decided_at).toBe(now.choices?.[1]?.decided_at)
    expect(payload.sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: address, subject: 'Your application to Second Flow Course' }),
    )
    // The rejection enrolls no one, and the result keeps the first acceptance.
    expect((await enrolled()).docs.map((e) => e.course)).toEqual([course.id])
    expect(now.result?.enrollments).toHaveLength(1)
    expect((await decide('accept', submission.id, other.id)).status).toBe(400)
    expect((await decide('accept', submission.id, 999999)).status).toBe(404)
  })

  it('marks a waiting enrollment rejected, undoes a decision, and accepts a rejected one again', async () => {
    const address = `undo-${RUN}@cilas.test`
    const submission = track(
      'form-submissions',
      await submit(address, [{ field: 'track', value: 'Film' }]),
    )
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Undo Probe', slug: personSlug('undo-probe'), visible: false },
        overrideAccess: true,
      }),
    )
    track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: address,
          password: 'probe-password-1',
          roles: ['member'],
          person: person.id,
        },
      })) as unknown as { id: number },
    )
    const waiting = track(
      'enrollments',
      (await payload.create({
        collection: 'enrollments',
        data: { person: person.id, course: course.id, status: 'applied' },
        overrideAccess: true,
      } as never)) as unknown as { id: number },
    )
    const status = async () =>
      (await payload.findByID({ collection: 'enrollments', id: waiting.id, overrideAccess: true }))
        .status
    const choice = async () =>
      await payload.findByID({
        collection: 'form-submissions',
        id: submission.id,
        overrideAccess: true,
      })

    expect((await decide('reopen', submission.id, course.id)).status).toBe(400)
    expect((await decide('reject', submission.id, course.id)).status).toBe(200)
    expect(await status()).toBe('rejected')

    expect((await decide('reopen', submission.id, course.id)).status).toBe(200)
    expect(await status()).toBe('applied')
    let now = await choice()
    expect(now.status).toBe('new')
    expect(now.decided_at).toBeNull()
    expect(now.choices?.[0]).toMatchObject({ decision: 'pending', decided_at: null })

    expect((await decide('accept', submission.id, course.id)).status).toBe(200)
    expect(await status()).toBe('accepted')
    now = await choice()
    expect(now.status).toBe('accepted')

    // Paid enrollments are never moved by an undo.
    await payload.update({
      collection: 'enrollments',
      id: waiting.id,
      data: { status: 'confirmed' },
      overrideAccess: true,
    })
    expect((await decide('reopen', submission.id, course.id)).status).toBe(400)
    expect(await status()).toBe('confirmed')
  })

  it('decides one course once when two requests arrive together', async () => {
    const address = `race-${RUN}@cilas.test`
    const submission = track(
      'form-submissions',
      await submit(address, [{ field: 'track', value: 'Film' }]),
    )
    vi.mocked(payload.sendEmail).mockClear()
    const answers = await Promise.all([
      decide('accept', submission.id, course.id),
      decide('accept', submission.id, course.id),
    ])
    expect(answers.map((r) => r.status).sort()).toEqual([200, 400])
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
    const user = (
      await payload.find({ collection: 'users', where: { email: { equals: address } }, depth: 0 })
    ).docs[0]!
    track('users', user as unknown as { id: number })
    const enrolled = await payload.find({
      collection: 'enrollments',
      where: { person: { equals: user.person } },
      overrideAccess: true,
      depth: 0,
    })
    enrolled.docs.forEach((e) => track('enrollments', e))
    expect(enrolled.totalDocs).toBe(1)
  })

  it('records a failed email, and sends it again', async () => {
    const address = `mailfail-${RUN}@cilas.test`
    const submission = track(
      'form-submissions',
      await submit(address, [{ field: 'track', value: 'Film' }]),
    )
    vi.mocked(payload.sendEmail).mockRejectedValueOnce(new Error('smtp down'))
    const first = await decide('reject', submission.id, course.id)
    expect(await first.json()).toMatchObject({ ok: true, emailed: false })
    const read = async () =>
      (
        await payload.findByID({
          collection: 'form-submissions',
          id: submission.id,
          overrideAccess: true,
        })
      ).choices?.[0]
    expect(await read()).toMatchObject({ decision: 'rejected', email_failed: true })

    vi.mocked(payload.sendEmail).mockClear()
    const again = await decide('resend', submission.id, course.id)
    expect(await again.json()).toMatchObject({ ok: true, emailed: true })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: address, subject: 'Your application to Flow Course' }),
    )
    expect((await read())?.email_failed).toBe(false)
    // Nothing to send for a course that waits.
    const waiting = track(
      'form-submissions',
      await submit(`wait-${RUN}@cilas.test`, [{ field: 'track', value: 'Film' }]),
    )
    expect((await decide('resend', waiting.id, course.id)).status).toBe(400)
  })

  it('the deadline closes the API too, not only the page, until it is lifted', async () => {
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        registration: { mode: 'own', method: 'form', form: form.id, deadline: '2020-01-01' },
      },
      overrideAccess: true,
    })

    await expect(restCreate(APPLICANT_EMAIL)).rejects.toThrow(/not open/)

    // A local caller (a seed, a backfill) may still add a historic one.
    const backfilled = await submit('backfill@cilas.test', [{ field: 'track', value: 'Film' }])
    track('form-submissions', backfilled)
    expect(backfilled.status).toBe('new')

    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { registration: { mode: 'own', method: 'form', form: form.id, deadline: null } },
      overrideAccess: true,
    })
    const after = await restCreate('late@cilas.test', [{ field: 'track', value: 'Film' }])
    track('form-submissions', after)
    expect(after.status).toBe('new')
  })
})

const cycleId = () => created.find((t) => t.collection === 'cycles')!.id
