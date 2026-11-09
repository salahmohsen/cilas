// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Form, User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from './fixtures'

let payload: Payload
let admin: User
let form: Form
const { track, cleanup } = createTracker()
const SECRET = uniqEmail('notify-secret')

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

describe('the notification addresses of a form', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('form-emails-admin'),
          password: crypto.randomUUID(),
          roles: ['admin'],
        },
        overrideAccess: true,
      })) as unknown as User,
    )
    form = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: {
          title: uniq('Emails probe'),
          confirmationType: 'message',
          confirmationMessage: thanks,
          fields: [{ blockType: 'text', name: 'q', label: 'Q' }],
          emails: [{ emailTo: SECRET, subject: 'New application', message: thanks }],
        } as never,
        overrideAccess: true,
      }),
    )
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('are not read by anyone who is not signed in', async () => {
    const byId = await payload.findByID({ collection: 'forms', id: form.id, overrideAccess: false })
    expect(byId.title).toBe(form.title)
    expect(byId.fields?.length).toBeGreaterThan(0)
    expect(JSON.stringify(byId)).not.toContain(SECRET)
    const list = await payload.find({
      collection: 'forms',
      where: { id: { equals: form.id } },
      overrideAccess: false,
    })
    expect(JSON.stringify(list)).not.toContain(SECRET)
  })

  it('are not read by a member', async () => {
    const member = track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('form-emails-member'),
          password: crypto.randomUUID(),
          roles: ['member'],
        },
        overrideAccess: true,
      })) as unknown as User,
    )
    const doc = await payload.findByID({
      collection: 'forms',
      id: form.id,
      user: { ...member, collection: 'users' } as never,
      overrideAccess: false,
    })
    expect(JSON.stringify(doc)).not.toContain(SECRET)
  })

  it('are read by an admin', async () => {
    const doc = await payload.findByID({
      collection: 'forms',
      id: form.id,
      user: { ...admin, collection: 'users' } as never,
      overrideAccess: false,
    })
    expect(doc.emails?.[0]?.emailTo).toBe(SECRET)
  })
})
