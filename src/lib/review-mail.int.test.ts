import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { Locale } from '@/i18n/routing'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { trustedWrites } from '../../testing/portal-lists.fixture'
import { resendInbox } from '../../testing/resend.test-utils'
import { emailRecipients, reviewEmailUrl, type LocalRecipient } from './review-mail'
import { sessionDb } from './row-lock'

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

afterEach(() => {
  vi.restoreAllMocks()
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

const failInPostgres = async (req: PayloadRequest) => {
  const adapter = payload.db as unknown as PostgresAdapter
  await ((await sessionDb(req)) ?? adapter.drizzle).execute(sql`select 1 / 0`)
}

const hookForThisTest = <Hook>(hooks: Hook[], hook: Hook) => {
  hooks.push(hook)
  onTestFinished(() => void hooks.splice(hooks.indexOf(hook), 1))
}

const breakCollectionRead = (
  slug: 'space-preferences' | 'users',
  matches: (args: { select?: Record<string, unknown> }) => boolean = () => true,
) => {
  const broken = { times: 0 }
  hookForThisTest(
    payload.collections[slug].config.hooks.beforeOperation,
    async ({ args, operation, req }) => {
      if (operation === 'read' && matches(args as { select?: Record<string, unknown> })) {
        broken.times += 1
        await failInPostgres(req)
      }
      return args
    },
  )
  return broken
}

const breakEmailSettingsRead = () => {
  const broken = { times: 0 }
  const { hooks } = payload.globals.config.find((item) => item.slug === 'email-settings')!
  hookForThisTest(hooks.beforeRead, async ({ doc, req }) => {
    broken.times += 1
    await failInPostgres(req)
    return doc
  })
  return broken
}

const storedStatus = async (id: number) => {
  const doc = await payload.findByID({
    collection: 'articles',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return doc.review?.status
}

const approve = (id: number, tier: 'community' | 'public' = 'community') =>
  payload.update({
    collection: 'articles',
    id,
    user: arabicAdmin,
    overrideAccess: false,
    locale: 'en',
    data: { tier, _status: 'published', review: { status: 'approved' } },
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

  it.each(['ar', 'en'] as const)(
    'sends the others their message and names who missed it when Resend refuses the %s admin',
    async (locale) => {
      const [refused, other] =
        locale === 'ar' ? [arabicAdmin, englishAdmin] : [englishAdmin, arabicAdmin]
      const logged = vi.spyOn(payload.logger, 'error')
      inbox.failFor = refused.email
      await submitAsOwner(`refused-${locale}`)

      expect(inbox.to(refused.email)).toHaveLength(0)
      expect(inbox.to(other.email)).toHaveLength(1)
      const entries = logged.mock.calls.map(([entry]) => entry as Record<string, unknown>)
      const dropped = entries.filter((entry) => entry.recipient === refused.id)
      expect(dropped).toHaveLength(1)
      expect(JSON.stringify(dropped)).not.toContain(refused.email)
    },
  )

  it('reads the email settings once, however many admins get the message', async () => {
    const reads = vi.spyOn(payload.db, 'findGlobal')
    await submitAsOwner('one-read')

    expect(inbox.to(arabicAdmin.email)).toHaveLength(1)
    expect(inbox.to(englishAdmin.email)).toHaveLength(1)
    expect(reads.mock.calls.filter(([args]) => args.slug === 'email-settings')).toHaveLength(1)
  })

  it.each([
    ['language', () => breakCollectionRead('space-preferences'), 'en'],
    [
      'preference',
      () => breakCollectionRead('users', (args) => Boolean(args.select?.notification_preferences)),
      'ar',
    ],
  ] as const)(
    'keeps the decision and still sends when the %s read fails in Postgres',
    async (label, breakIt, ownerLocale) => {
      const broken = breakIt()
      const id = await submitAsOwner(`broken-${label}`)

      expect(await storedStatus(id)).toBe('submitted')
      expect(inbox.to(arabicAdmin.email)).toHaveLength(1)
      expect(inbox.to(englishAdmin.email)).toHaveLength(1)

      await approve(id)

      expect(broken.times).toBe(2)
      expect(await storedStatus(id)).toBe('approved')
      const messages = inbox.to(owner.email)
      expect(messages).toHaveLength(1)
      expect(hrefsOf(messages[0]!.html)).toContain(
        reviewEmailUrl(localRecipient(owner, ownerLocale), {
          collection: 'articles',
          id,
          viewer: 'owner',
          waiting: false,
        }),
      )
    },
  )

  it('keeps the decision and names who missed the email when the settings read fails', async () => {
    const id = await submitAsOwner('broken-settings')
    const logged = vi.spyOn(payload.logger, 'error')
    const broken = breakEmailSettingsRead()

    await approve(id)

    expect(broken.times).toBe(1)
    expect(await storedStatus(id)).toBe('approved')
    expect(inbox.to(owner.email)).toHaveLength(0)
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ recipient: owner.id }))
  })

  it.each([
    ['community', 'for the community'],
    ['public', 'on the public site'],
  ] as const)('names the %s tier in the approval notification', async (tier, wording) => {
    const title = uniq(`Review mail approval ${tier}`)
    const id = await draftArticle(title, tier)
    await trustedWrites(payload, track).submit('articles', id)
    await approve(id, tier)

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
