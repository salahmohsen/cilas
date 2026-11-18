import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { formEmailRichText } from '@/forms/email-rich-text'
import { readProfile, saveProfile } from '@/lib/profile'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  detail: 0,
  style: '',
  mode: 'normal',
})
const paragraph = (children: unknown[]) => ({
  type: 'paragraph',
  version: 1,
  children,
  format: '',
  indent: 0,
  direction: null,
})
const document = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, format: '', indent: 0, direction: null },
})

describe('protected profile bios', () => {
  it('shows a readable bio and refuses a replacement that would discard its mention', async () => {
    const mentioned = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Mona', slug: uniq('bio-mentioned'), visible: true },
        overrideAccess: true,
      }),
    ).id
    const bio = document([
      paragraph([
        text('Taught by '),
        {
          type: 'inlineBlock',
          version: 1,
          fields: {
            id: 'm',
            blockType: 'mention',
            type: 'person',
            person: mentioned,
            label: 'Mona',
          },
        },
      ]),
    ])
    const owner = track(
      'people',
      await payload.create({
        collection: 'people',
        locale: 'en',
        data: { name: 'Reader', slug: uniq('bio-owner'), bio } as never,
        user: { id: -1, roles: ['admin'], collection: 'users' } as unknown as User,
        overrideAccess: true,
      }),
    ).id
    const user = { id: -7, person: owner, collection: 'users' } as unknown as User
    const profile = await readProfile(payload, user)
    expect(profile?.bio.en).toBe('Taught by Mona')
    expect(profile?.bioReadOnly?.en).toBe(true)
    const result = await saveProfile(payload, user, {
      name: { en: 'Reader', ar: '' },
      bio: { en: 'Replacement', ar: '' },
      website: '',
      socialLinks: [],
    })
    expect(result).toEqual({ ok: false, error: 'bio' })
    const stored = await payload.findByID({
      collection: 'people',
      id: owner,
      locale: 'en',
      overrideAccess: true,
    })
    expect(JSON.stringify(stored.bio)).toContain('"blockType":"mention"')
  })
})

describe('form email substitutions', () => {
  it('escapes submitted text, sanitizes substituted links, and keeps the submission ID', async () => {
    const message = document([
      paragraph([
        text('{{name}} {{formSubmissionID}}'),
        {
          type: 'link',
          version: 3,
          fields: { linkType: 'custom', url: '{{url}}' },
          children: [text('Link')],
        },
      ]),
    ])
    const form = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: {
          title: uniq('email-substitutions'),
          fields: [
            { blockType: 'text', name: 'name', label: 'Name' },
            { blockType: 'text', name: 'url', label: 'Url' },
          ],
          confirmationMessage: message,
          emails: [{ emailTo: 'cilas@example.com', subject: 'Test', message }],
        } as never,
        overrideAccess: true,
      }),
    ).id
    const member = { id: -2, roles: ['member'], collection: 'users' }
    const req = await createLocalReq({ locale: 'en', user: member as never }, payload)
    const params = {
      data: {
        form,
        submissionData: [
          { field: 'name', value: '<script>bad</script>' },
          { field: 'url', value: 'javascript:alert(1)' },
        ],
      },
      doc: { id: 42 },
      req,
    } as unknown as Parameters<typeof formEmailRichText>[1]
    const [mail] = await formEmailRichText(
      [
        {
          to: 'reader@example.com',
          from: 'cilas@example.com',
          replyTo: 'cilas@example.com',
          subject: 'Test',
          html: '',
        },
      ],
      params,
    )
    expect(mail.html).toContain('&lt;script&gt;bad&lt;/script&gt; 42')
    expect(mail.html).not.toContain('href="javascript:')
  })
})
