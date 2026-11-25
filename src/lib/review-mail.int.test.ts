import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/routing'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { trustedWrites } from '../../testing/portal-lists.fixture'
import { resendInbox } from '../../testing/resend.test-utils'
import { emailRecipients, reviewEmailUrl, type LocalRecipient } from './review-mail'

const inbox = resendInbox()
mockNetwork(inbox.handler, ...localServices)
const { track, cleanup } = createTracker()

const hrefsOf = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])

let payload: Payload
let owner: User
let arabicAdmin: User
let englishAdmin: User
let optedOut: User

const account = async (label: string, role: 'admin' | 'fellow', locale?: Locale, mute = false) => {
  const person =
    role === 'fellow'
      ? track(
          'people',
          await payload.create({
            collection: 'people',
            data: { name: 'Review mail owner', slug: uniq('review-mail-owner') },
          }),
        ).id
      : undefined
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      depth: 0,
      data: {
        email: uniqEmail(`review-mail-${label}`),
        password: crypto.randomUUID(),
        roles: [role],
        person,
        ...(mute ? { notification_preferences: { email: { submitted: false } } } : {}),
      },
    }),
  )
  if (locale) {
    await payload.create({
      collection: 'space-preferences',
      data: { account: user.id, locale, digest: 'weekly' },
      overrideAccess: true,
    })
  }
  return user
}

beforeAll(async () => {
  payload = await getPayload({ config })
  owner = await account('owner', 'fellow', 'ar')
  arabicAdmin = await account('ar-admin', 'admin', 'ar')
  englishAdmin = await account('en-admin', 'admin')
  optedOut = await account('muted-admin', 'admin', undefined, true)
})

afterAll(async () => {
  if (!payload) return
  await cleanup(payload)
  await payload.destroy()
})

const draftArticle = (title: string, slug: string) =>
  trustedWrites(payload, track).create('articles', {
    title,
    slug: uniq(`review-mail-${slug}`),
    authors: [Number(owner.person)],
    tier: 'owner',
    review: { status: 'draft' },
  })

describe('review-events: one email per recipient', () => {
  it('keeps the saved locale, defaults to English, and filters email opt-outs', async () => {
    const req = await createLocalReq({}, payload)
    const recipients = [arabicAdmin, englishAdmin, optedOut].map(({ id, email }) => ({ id, email }))
    expect(await emailRecipients(req, recipients, 'submitted')).toEqual([
      { ...recipients[0], locale: 'ar' },
      { ...recipients[1], locale: 'en' },
    ])
  })

  const submitAsOwner = async (slug: string) => {
    const id = await draftArticle(uniq(`Review mail ${slug}`), slug)
    await payload.update({
      collection: 'articles',
      id,
      user: owner,
      overrideAccess: false,
      locale: 'en',
      data: { _status: 'draft', review: { status: 'submitted' } },
    })
    return id
  }

  const localRecipient = ({ id, email }: User, locale: Locale) =>
    ({ id, email, locale }) satisfies LocalRecipient

  it('sends each subscribed admin their own message when a fellow submits', async () => {
    const id = await submitAsOwner('submitted')

    for (const recipient of [
      localRecipient(arabicAdmin, 'ar'),
      localRecipient(englishAdmin, 'en'),
    ]) {
      const messages = inbox.to(recipient.email)
      expect(messages).toHaveLength(1)
      expect([messages[0]!.to].flat()).toEqual([recipient.email])
      expect(hrefsOf(messages[0]!.html)).toContain(
        reviewEmailUrl(recipient, {
          collection: 'articles',
          id,
          viewer: 'admin',
          waiting: true,
        }),
      )
    }
    expect(inbox.sent.filter((mail) => [mail.to].flat().length !== 1)).toEqual([])
    expect(inbox.to(optedOut.email)).toHaveLength(0)
  })

  it('still sends the others their message when Resend refuses one recipient', async () => {
    inbox.failFor = englishAdmin.email
    await submitAsOwner('refused')

    expect(inbox.to(englishAdmin.email)).toHaveLength(0)
    expect(inbox.to(arabicAdmin.email)).toHaveLength(1)
  })

  it.each([
    ['community', 'for the community'],
    ['public', 'on the public site'],
  ] as const)('names the %s tier in the approval notification', async (tier, wording) => {
    const title = uniq('Review mail approval')
    const id = await draftArticle(title, tier)
    await trustedWrites(payload, track).submit('articles', id)
    await payload.update({
      collection: 'articles',
      id,
      user: arabicAdmin,
      overrideAccess: false,
      locale: 'en',
      data: { tier, _status: 'published', review: { status: 'approved' } },
    })

    const { docs } = await payload.find({
      collection: 'notifications',
      where: {
        recipient: { equals: owner.id },
        kind: { equals: 'approved' },
        description: { contains: title },
      },
      depth: 0,
      limit: 2,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]!.description).toBe(`Your article “${title}” was published ${wording}`)
    const messages = inbox.to(owner.email)
    expect(messages).toHaveLength(1)
    expect(hrefsOf(messages[0]!.html)).toContain(
      reviewEmailUrl(localRecipient(owner, 'ar'), {
        collection: 'articles',
        id,
        viewer: 'owner',
        waiting: false,
      }),
    )
  })
})
