import { http, HttpResponse } from 'msw'
import { getPayload, type Payload } from 'payload'
import webpush from 'web-push'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { PushConfig } from '@/lib/push/config'
import { pushBody, sendPushForNotification } from '@/lib/push/send'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { localServices } from '../../../testing/local-services.test-utils'
import { createTracker, uniq, uniqEmail } from '../../../testing/payload.fixture'
import { pushDevice } from '../../../testing/web-push.test-utils'

const vapid = webpush.generateVAPIDKeys()
const pushConfig = {
  publicKey: vapid.publicKey,
  privateKey: vapid.privateKey,
  subject: 'mailto:a@b.org',
} satisfies PushConfig

const note = (recipient: number) => ({
  id: 7,
  recipient,
  kind: 'reaction',
  description: 'Sam liked your post in “Seminar”',
  link: '/spaces/course/x/posts/9',
})

const phone = pushDevice()
const answers = new Map<string, number>()
const received = new Map<string, ArrayBuffer>()
mockNetwork(
  ...localServices,
  http.post('https://fcm.googleapis.com/fcm/send/:id', async ({ request, params }) => {
    const id = String(params.id)
    received.set(id, await request.arrayBuffer())
    return new HttpResponse(null, { status: answers.get(id) ?? 201 })
  }),
)

let payload: Payload
const { track, cleanup } = createTracker()
const subscriptions: number[] = []
let accounts = 0

const recipient = async (preferences?: User['notification_preferences']) =>
  (
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(`push-${++accounts}`),
        password: crypto.randomUUID(),
        roles: ['member'],
        ...(preferences ? { notification_preferences: preferences } : {}),
      },
      overrideAccess: true,
    })
  ).id

const subscribe = async (user: number, locale: 'en' | 'ar' = 'en') => {
  const id = uniq(`device-${++accounts}`)
  const row = await payload.create({
    collection: 'push-subscriptions',
    data: {
      user,
      endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
      p256dh: phone.p256dh,
      auth: phone.auth,
      locale,
    },
    overrideAccess: true,
  })
  subscriptions.push(row.id)
  return { id, row: row.id }
}

const stillThere = async (row: number) =>
  (
    await payload.find({
      collection: 'push-subscriptions',
      where: { id: { equals: row } },
      overrideAccess: true,
    })
  ).totalDocs === 1

const sentTo = (id: string) => received.has(id)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const id of subscriptions)
    await payload
      .delete({ collection: 'push-subscriptions', id, overrideAccess: true })
      .catch(() => undefined)
  await cleanup(payload)
  await payload.destroy()
})

describe('sendPushForNotification', () => {
  it('sends to every device of a recipient who allows push', async () => {
    const user = track('users', { id: await recipient() }).id
    const first = await subscribe(user)
    const second = await subscribe(user, 'ar')
    await sendPushForNotification(payload, note(user), { config: pushConfig })
    const english = JSON.parse(phone.open(received.get(first.id)!))
    const arabic = JSON.parse(phone.open(received.get(second.id)!))
    expect(english.title).toBe('New reaction')
    expect(arabic.title).toBe('تفاعل جديد')
    expect(english.url).toBe('/spaces/course/x/posts/9')
  })

  it('sends nothing when the recipient turned push off for the kind', async () => {
    const user = track('users', { id: await recipient({ push: { reaction: false } }) }).id
    const subscribed = await subscribe(user)
    await sendPushForNotification(payload, note(user), { config: pushConfig })
    expect(sentTo(subscribed.id)).toBe(false)
  })

  it('still sends a kind the recipient did not turn off', async () => {
    const user = track('users', { id: await recipient({ push: { reply: false } }) }).id
    const subscribed = await subscribe(user)
    await sendPushForNotification(payload, note(user), { config: pushConfig })
    expect(sentTo(subscribed.id)).toBe(true)
  })

  it('sends nothing, and reads nothing, without VAPID keys', async () => {
    const user = track('users', { id: await recipient() }).id
    const subscribed = await subscribe(user)
    const find = vi.spyOn(payload, 'find')
    await sendPushForNotification(payload, note(user), { config: null })
    expect(sentTo(subscribed.id)).toBe(false)
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })

  it.each([404, 410])('deletes a subscription the push service answers %i for', async (status) => {
    const user = track('users', { id: await recipient() }).id
    const gone = await subscribe(user)
    const kept = await subscribe(user)
    answers.set(gone.id, status)
    await sendPushForNotification(payload, note(user), { config: pushConfig })
    expect(await stillThere(gone.row)).toBe(false)
    expect(await stillThere(kept.row)).toBe(true)
  })

  it('keeps the subscription on other errors and never throws', async () => {
    const user = track('users', { id: await recipient() }).id
    const failing = await subscribe(user)
    answers.set(failing.id, 500)
    const logger = vi.spyOn(payload.logger, 'error')
    await expect(
      sendPushForNotification(payload, note(user), { config: pushConfig }),
    ).resolves.toBeUndefined()
    expect(await stillThere(failing.row)).toBe(true)
    expect(logger).toHaveBeenCalled()
    logger.mockRestore()
  })

  it('never throws when the database read fails', async () => {
    const logger = vi.spyOn(payload.logger, 'error')
    await expect(
      sendPushForNotification(payload, note(2_000_000_000), { config: pushConfig }),
    ).resolves.toBeUndefined()
    expect(logger).toHaveBeenCalled()
    logger.mockRestore()
  })
})

describe('pushBody', () => {
  it('stays under 4 KB and carries only the in-app line', () => {
    const json = pushBody({ ...note(3), description: 'x'.repeat(10_000) }, 'en')
    expect(Buffer.byteLength(json)).toBeLessThan(4096)
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(['body', 'icon', 'tag', 'title', 'url'])
  })

  it('points to the home page for a link that is not a site path', () => {
    expect(JSON.parse(pushBody({ ...note(3), link: 'https://evil.example/x' }, 'en')).url).toBe('/')
    expect(JSON.parse(pushBody({ ...note(3), link: null }, 'en')).url).toBe('/')
  })
})
