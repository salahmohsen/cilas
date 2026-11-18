import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EMAILS } from '@/emails/catalog'
import { fill } from '@/emails/settings'
import { TURNSTILE_VERIFIED } from '@/lib/turnstile'
import config from '@/payload.config'
import type { Form, FormSubmission, Programme, User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { resendInbox } from '../../testing/resend.test-utils'
import { uniq, uniqEmail } from '../../testing/payload.fixture'

let payload: Payload
let admin: User
let form: Form
let programme: Programme
const EMAIL = uniqEmail('applicant-probe')
const ADMIN_EMAIL = uniqEmail('decision-admin-probe')
const APPLICANT = uniq('Applicant Probe')

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

const submit = (
  target: FormSubmission['target'],
  formId = form.id,
  locale?: FormSubmission['locale'],
) =>
  payload.create({
    collection: 'form-submissions',
    data: {
      form: formId,
      target,
      locale,
      choices: target?.relationTo === 'courses' ? [{ course: Number(target.value) }] : [],
      submissionData: [
        { field: 'name', value: APPLICANT },
        { field: 'email', value: EMAIL.toUpperCase() },
      ],
    },
  })

const decide = async (
  action: 'accept' | 'reject' | 'reopen' | 'resend',
  id: number,
  user: User | null = admin,
) => {
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

const outbox = resendInbox()
mockNetwork(outbox.handler, ...localServices)

describe('accepting an application', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
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
    expect(outbox.sent).toContainEqual(expect.objectContaining({ to: EMAIL }))

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
    outbox.sent = []
    expect((await decide('reject', submission.id)).status).toBe(200)
    expect(outbox.sent).toContainEqual(
      expect.objectContaining({
        to: EMAIL,
        subject: expect.stringContaining('Your application to'),
      }),
    )
    const after = await payload.findByID({
      collection: 'form-submissions',
      id: submission.id,
      depth: 0,
    })
    expect(after.status).toBe('rejected')
    expect(after.result?.user).toBeFalsy()
    expect((await decide('reopen', submission.id)).status).toBe(200)
    expect(
      (await payload.findByID({ collection: 'form-submissions', id: submission.id, depth: 0 }))
        .status,
    ).toBe('new')
  })

  it('sends the decision emails in the language the applicant used', async () => {
    const arTitle = 'إقامة تجريبية'
    const arSubject = 'مرحبا بك في {title}'
    await payload.update({
      collection: 'programmes',
      id: programme.id,
      data: { title: arTitle },
      locale: 'ar',
    })
    const before = await payload.findGlobal({
      slug: 'email-settings',
      locale: 'ar',
      fallbackLocale: false,
    })
    await payload.updateGlobal({
      slug: 'email-settings',
      locale: 'ar',
      data: { texts: { acceptance: { subject: arSubject }, rejection: { subject: '' } } },
    })
    try {
      const sent = () => outbox.sent.at(-1)!

      const accepted = await submit(
        { relationTo: 'programmes', value: programme.id },
        form.id,
        'ar',
      )
      expect(accepted.locale).toBe('ar')
      outbox.sent = []
      expect((await decide('accept', accepted.id)).status).toBe(200)
      expect(sent().subject).toContain('مرحبا بك في')
      expect(sent().subject).toContain(arTitle)
      expect(sent().html).toContain('lang="ar"')
      expect(sent().html).toContain('dir="rtl"')
      expect(sent().html).toContain('/ar/welcome/')

      outbox.sent = []
      expect((await decide('resend', accepted.id)).status).toBe(200)
      expect(sent().subject).toContain('مرحبا بك في')

      const rejected = await submit(
        { relationTo: 'programmes', value: programme.id },
        form.id,
        'ar',
      )
      outbox.sent = []
      expect((await decide('reject', rejected.id)).status).toBe(200)
      expect(sent().subject).toBe(
        fill(EMAILS.rejection.texts.ar.subject, { title: `\u2068${arTitle}\u2069` }),
      )
      expect(sent().html).toContain('dir="rtl"')

      const english = await submit({ relationTo: 'programmes', value: programme.id })
      expect(english.locale).toBe('en')
      outbox.sent = []
      expect((await decide('accept', english.id)).status).toBe(200)
      expect(sent().subject).toContain('Probe residency')
      expect(sent().subject).not.toContain('مرحبا')
      expect(sent().html).toContain('lang="en"')
      expect(sent().html).toContain('/en/welcome/')
    } finally {
      await payload.updateGlobal({
        slug: 'email-settings',
        locale: 'ar',
        data: { texts: { acceptance: { subject: before.texts?.acceptance?.subject ?? '' } } },
      })
    }
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
