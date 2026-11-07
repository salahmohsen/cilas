// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { TURNSTILE_VERIFIED } from '@/lib/turnstile'
import type { Course, Form, FormSubmission, Person, User } from '@/payload-types'

/**
 * The whole application flow: a fellow writes a course's application
 * questions, an admin makes the registration form (name and email in every
 * form, not removable), an anonymous applicant answers by the options' labels,
 * and an admin's acceptance makes or finds the account, links a person and
 * enrolls them.
 */

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

/** The form builder requires a confirmation message. */
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
      submissionData: [
        { field: 'name', value: 'Mona Farid' },
        { field: 'email', value: email },
        ...data,
      ],
    },
  })

/** Creates as the site's REST API would, so boundary hooks cannot skip it.
 * The Turnstile context marks it the way the files endpoint marks its own
 * submission: the spam check already ran where the request came from. */
const restCreate = async (
  email: string,
  data: { field: string; value: string }[] = [],
): Promise<FormSubmission> => {
  const req = await createLocalReq({ user: undefined }, payload)
  ;(req as { payloadAPI?: string }).payloadAPI = 'REST'
  return payload.create({
    collection: 'form-submissions',
    data: {
      form: form.id,
      target: { relationTo: 'courses', value: course.id },
      submissionData: [
        { field: 'name', value: 'Mona Farid' },
        { field: 'email', value: email },
        ...data,
      ],
    },
    context: { [TURNSTILE_VERIFIED]: true },
    req,
  } as never) as unknown as FormSubmission
}

/** Calls a decision endpoint as an admin, the way the Accept button does. */
const decide = async (action: 'accept' | 'reject', id: number) => {
  const endpoint = (
    payload.collections['form-submissions'].config.endpoints as {
      path: string
      handler: (req: never) => Promise<Response>
    }[]
  ).find((e) => e.path === `/:id/${action}`)!
  const req = await createLocalReq({ user: admin }, payload)
  req.routeParams = { id: String(id) }
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
    // Nothing was built yet, and the two default questions stand there.
    expect(first.map((b) => [b.blockType, (b as { name?: string }).name])).toEqual([
      ['text', 'name'],
      ['email', 'email'],
    ])
    expect(first.every((b) => (b as { required?: boolean }).required === true)).toBe(true)

    // An admin deleting or renaming them leaves the form as it was.
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

    // The course registers through the form.
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { registration: { method: 'form', form: form.id } },
      overrideAccess: true,
    })
  })

  it('an anonymous applicant applies; the acceptance makes the account and enrolls', async () => {
    const submission = await submit(APPLICANT_EMAIL, [
      { field: 'track', value: 'Anthropology' }, // the label selects it on site
      { field: 'course_years', value: '3' },
    ])
    track('form-submissions', submission)
    expect(submission.status).toBe('new')

    const res = await decide('accept', submission.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, emailed: true })

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
    expect(decided.result).toEqual({
      user: docs[0].id,
      person: person!.id,
      enrollment: enrollments.docs[0].id,
      membership: null,
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
      { field: 'course_years', value: '1' },
    ])
    track('form-submissions', submission)

    const res = await decide('accept', submission.id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body).toEqual({ ok: true, emailed: true })

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

  it('an admin rejects a new submission, and only a new one', async () => {
    const submission = await submit('second@cilas.test', [])
    track('form-submissions', submission)
    const res = await decide('reject', submission.id)
    expect(res.status).toBe(200)
    const rejected = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      overrideAccess: true,
    })
    expect(rejected.status).toBe('rejected')
    expect(rejected.decided_at).toBeTruthy()

    const again = await decide('reject', submission.id)
    expect(again.status).toBe(400)
  })

  it('the deadline closes the API too, not only the page, until it is lifted', async () => {
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { registration: { method: 'form', form: form.id, deadline: '2020-01-01' } },
      overrideAccess: true,
    })

    // Through the API the submission is refused, whatever the page sent.
    await expect(restCreate(APPLICANT_EMAIL)).rejects.toThrow(/not open/)

    // A local caller (a seed, a backfill) may still add a historic one.
    const backfilled = await submit('backfill@cilas.test', [])
    track('form-submissions', backfilled)
    expect(backfilled.status).toBe('new')

    // The deadline lifted, the same API submission goes through.
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { registration: { method: 'form', form: form.id, deadline: null } },
      overrideAccess: true,
    })
    const after = await restCreate('late@cilas.test', [{ field: 'track', value: 'Film' }])
    track('form-submissions', after)
    expect(after.status).toBe('new')
  })
})

/** The cycle created in beforeAll; the course must name one. */
const cycleId = () => created.find((t) => t.collection === 'cycles')!.id
