// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { TURNSTILE_VERIFIED } from '@/lib/turnstile'
import config from '@/payload.config'
import type { Form, FormSubmission, Programme, User } from '@/payload-types'

import { uniq, uniqEmail } from './fixtures'

let payload: Payload
let admin: User
let form: Form
let programme: Programme
const EMAIL = uniqEmail('applicant-probe')
const ADMIN_EMAIL = uniqEmail('decision-admin-probe')
// The person is found by name, so a unique name keeps old runs out of the count.
const APPLICANT = uniq('Applicant Probe')

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

const submit = (target: FormSubmission['target'], formId = form.id) =>
  payload.create({
    collection: 'form-submissions',
    data: {
      form: formId,
      target,
      choices: target?.relationTo === 'courses' ? [{ course: Number(target.value) }] : [],
      submissionData: [
        { field: 'name', value: APPLICANT },
        { field: 'email', value: EMAIL.toUpperCase() },
      ],
    },
  })

const decide = async (action: 'accept' | 'reject', id: number, user: User | null = admin) => {
  const endpoint = payload.collections['form-submissions'].config.endpoints
    ? (
        payload.collections['form-submissions'].config.endpoints as {
          path: string
          handler: (req: never) => Promise<Response>
        }[]
      ).find((e) => e.path === `/:id/${action}`)!
    : null
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { id: String(id) }
  return endpoint!.handler(req as never)
}

const cleanup = async () => {
  const users = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    depth: 0,
  })
  for (const u of users.docs) {
    const person = typeof u.person === 'object' ? u.person?.id : u.person
    await payload.delete({ collection: 'users', id: u.id })
    if (person) {
      await payload.delete({ collection: 'memberships', where: { person: { equals: person } } })
      await payload.delete({ collection: 'people', id: person }).catch(() => undefined)
    }
  }
}

describe('accepting an application', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    await cleanup()
    admin = await payload.create({
      collection: 'users',
      data: {
        email: ADMIN_EMAIL,
        password: 'probe-password-1',
        roles: ['admin'],
      },
    })
    form = await payload.create({
      collection: 'forms',
      data: {
        title: 'Application probe',
        confirmationType: 'message',
        confirmationMessage: thanks,
        fields: [
          { blockType: 'text', name: 'name', label: 'Name', required: true },
          { blockType: 'email', name: 'email', label: 'Email', required: true },
        ],
      },
    })
    programme = await payload.create({
      collection: 'programmes',
      data: {
        title: 'Probe residency',
        kind: 'residency',
        registration: { method: 'form', form: form.id },
      },
      draft: true,
    })
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup()
    await payload.delete({ collection: 'form-submissions', where: { form: { equals: form.id } } })
    await payload.delete({ collection: 'programmes', id: programme.id }).catch(() => undefined)
    await payload.delete({ collection: 'forms', id: form.id }).catch(() => undefined)
    await payload.delete({ collection: 'users', id: admin.id }).catch(() => undefined)
    await payload.destroy()
  })

  it('refuses a target that does not register through the form', async () => {
    const other = await payload.create({
      collection: 'forms',
      data: {
        title: 'Other probe',
        fields: [],
        confirmationType: 'message',
        confirmationMessage: thanks,
      },
    })
    await expect(
      submit({ relationTo: 'programmes', value: programme.id }, other.id),
    ).rejects.toThrow(/not the registration form/)
    await payload.delete({ collection: 'forms', id: other.id })
  })

  it('makes the account, a hidden person and the membership, once', async () => {
    const submission = await submit({ relationTo: 'programmes', value: programme.id })
    expect(submission.status).toBe('new')

    const res = await decide('accept', submission.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, emailed: true })
    expect(payload.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL }))

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: EMAIL } },
      depth: 1,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0].roles).toEqual(['member'])
    const person = docs[0].person as { id: number; name: string; visible: boolean }
    expect(person).toMatchObject({ name: APPLICANT, visible: false })

    const memberships = await payload.find({
      collection: 'memberships',
      where: { person: { equals: person.id } },
    })
    expect(memberships.docs).toHaveLength(1)
    expect(memberships.docs[0]).toMatchObject({ role: 'student' })

    const after = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
    })
    expect(after).toMatchObject({
      status: 'accepted',
      result: { user: docs[0].id, person: person.id },
    })

    // A second application from the same email reuses everything.
    const again = await submit({ relationTo: 'programmes', value: programme.id })
    expect((await decide('accept', again.id)).status).toBe(200)
    expect(
      (await payload.find({ collection: 'users', where: { email: { equals: EMAIL } } })).totalDocs,
    ).toBe(1)
    expect(
      (await payload.find({ collection: 'memberships', where: { person: { equals: person.id } } }))
        .totalDocs,
    ).toBe(1)
  })

  it('hides the new person from visitors', async () => {
    const { docs } = await payload.find({
      collection: 'people',
      where: { name: { equals: APPLICANT } },
      overrideAccess: false,
    })
    expect(docs).toHaveLength(0)
  })

  it('rejects without making anything, and only admins decide', async () => {
    const submission = await submit({ relationTo: 'programmes', value: programme.id })
    expect((await decide('accept', submission.id, null)).status).toBe(403)
    expect((await decide('reject', submission.id)).status).toBe(200)
    const after = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
    })
    expect(after.status).toBe('rejected')
    expect(after.result?.user).toBeFalsy()
  })

  it('reports a submission without a name or email', async () => {
    const submission = await payload.create({
      collection: 'form-submissions',
      data: {
        form: form.id,
        target: { relationTo: 'programmes', value: programme.id },
        submissionData: [],
      },
    })
    const res = await decide('accept', submission.id)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/)
  })

  it('refuses, from outside, a target that was never published, and accepts it once published', async () => {
    const draft = await payload.create({
      collection: 'programmes',
      data: {
        title: 'Unpublished probe',
        kind: 'residency',
        registration: { method: 'form', form: form.id },
      },
      draft: true,
    })
    const fromOutside = () =>
      payload.create({
        collection: 'form-submissions',
        data: {
          form: form.id,
          target: { relationTo: 'programmes', value: draft.id },
          submissionData: [
            { field: 'name', value: APPLICANT },
            { field: 'email', value: EMAIL },
          ],
        },
        context: { [TURNSTILE_VERIFIED]: true },
        req: { payloadAPI: 'REST' } as never,
      })
    try {
      await expect(fromOutside()).rejects.toThrow(/not open for applications/)
      await payload.update({
        collection: 'programmes',
        id: draft.id,
        data: { _status: 'published' },
      })
      await expect(fromOutside()).resolves.toMatchObject({ status: 'new' })
    } finally {
      await payload.delete({ collection: 'form-submissions', where: { form: { equals: form.id } } })
      await payload.delete({ collection: 'programmes', id: draft.id }).catch(() => undefined)
    }
  })
})
