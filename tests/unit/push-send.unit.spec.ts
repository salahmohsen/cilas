import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { PushConfig } from '@/lib/push/config'
import { pushBody, sendPushForNotification, type PushSender } from '@/lib/push/send'

const config: PushConfig = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.org' }
const note = {
  id: 7,
  recipient: 3,
  kind: 'reaction',
  description: 'Sam liked your post in “Seminar”',
  link: '/spaces/course/x/posts/9',
}

type Row = { id: number; endpoint: string; p256dh: string; auth: string; locale?: string }
const row = (id: number, locale = 'en'): Row => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'k',
  auth: 'a',
  locale,
})

const fakePayload = (rows: Row[], preferences: unknown = null) => {
  const remove = vi.fn(async () => ({}))
  const payload = {
    findByID: vi.fn(async () => ({ notification_preferences: preferences })),
    find: vi.fn(async () => ({ docs: rows })),
    delete: remove,
    logger: { error: vi.fn() },
  } as unknown as Payload
  return {
    payload,
    remove,
    logger: (payload.logger as unknown as { error: ReturnType<typeof vi.fn> }).error,
  }
}

const gone = (statusCode: number) => Object.assign(new Error('push failed'), { statusCode })

describe('sendPushForNotification', () => {
  it('sends to every device of a recipient who allows push', async () => {
    const { payload } = fakePayload([row(1), row(2, 'ar')])
    const sender = vi.fn<PushSender>(async () => ({}))
    await sendPushForNotification(payload, note, { config, sender })
    expect(sender).toHaveBeenCalledTimes(2)
    const bodies = sender.mock.calls.map((c) => JSON.parse(c[1]))
    expect(bodies[0].title).toBe('New reaction')
    expect(bodies[1].title).toBe('تفاعل جديد')
    expect(bodies[0].url).toBe('/spaces/course/x/posts/9')
  })

  it('sends nothing when the recipient turned push off for the kind', async () => {
    const { payload } = fakePayload([row(1)], { push: { reaction: false } })
    const sender = vi.fn<PushSender>(async () => ({}))
    await sendPushForNotification(payload, note, { config, sender })
    expect(sender).not.toHaveBeenCalled()
  })

  it('still sends a kind the recipient did not turn off', async () => {
    const { payload } = fakePayload([row(1)], { push: { reply: false } })
    const sender = vi.fn<PushSender>(async () => ({}))
    await sendPushForNotification(payload, note, { config, sender })
    expect(sender).toHaveBeenCalledTimes(1)
  })

  it('sends nothing, and reads nothing, without VAPID keys', async () => {
    const { payload } = fakePayload([row(1)])
    const sender = vi.fn<PushSender>(async () => ({}))
    await sendPushForNotification(payload, note, { config: null, sender })
    expect(sender).not.toHaveBeenCalled()
    expect(payload.find).not.toHaveBeenCalled()
  })

  it.each([404, 410])('deletes a subscription the push service answers %i for', async (status) => {
    const { payload, remove } = fakePayload([row(1), row(2)])
    const sender = vi.fn<PushSender>(async (sub) => {
      if (sub.endpoint.endsWith('/1')) throw gone(status)
      return {}
    })
    await sendPushForNotification(payload, note, { config, sender })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it('keeps the subscription on other errors and never throws', async () => {
    const { payload, remove, logger } = fakePayload([row(1)])
    const sender = vi.fn<PushSender>(async () => {
      throw gone(500)
    })
    await expect(
      sendPushForNotification(payload, note, { config, sender }),
    ).resolves.toBeUndefined()
    expect(remove).not.toHaveBeenCalled()
    expect(logger).toHaveBeenCalled()
  })

  it('never throws when the database read fails', async () => {
    const { payload, logger } = fakePayload([row(1)])
    ;(payload.findByID as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'))
    await expect(
      sendPushForNotification(payload, note, { config, sender: vi.fn() }),
    ).resolves.toBeUndefined()
    expect(logger).toHaveBeenCalled()
  })
})

describe('pushBody', () => {
  it('stays under 4 KB and carries only the in-app line', () => {
    const json = pushBody({ ...note, description: 'x'.repeat(10_000) }, 'en')
    expect(Buffer.byteLength(json)).toBeLessThan(4096)
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(['body', 'icon', 'tag', 'title', 'url'])
  })

  it('points to the home page for a link that is not a site path', () => {
    expect(JSON.parse(pushBody({ ...note, link: 'https://evil.example/x' }, 'en')).url).toBe('/')
    expect(JSON.parse(pushBody({ ...note, link: null }, 'en')).url).toBe('/')
  })
})
