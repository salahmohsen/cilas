import { describe, expect, it } from 'vitest'

import { PushSubscriptions } from '@/collections/PushSubscriptions'
import { pushBody } from '@/lib/push/send'
import { isPushServiceEndpoint, subscriptionSchema } from '@/lib/push/subscriptions'

const keys = { p256dh: 'k', auth: 'a' }

describe('push endpoint check', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('accepts %s', (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true)
    expect(subscriptionSchema.safeParse({ endpoint, keys }).success).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/push',
    'https://internal.example.org/push',
    'https://evilfcm.googleapis.com.evil.org/x',
    'https://notfcm.googleapis.com@evil.org/x',
    'https://fcm.googleapis.com:8443/x',
    'https://user:pw@fcm.googleapis.com/x',
    'not a url',
  ])('refuses %s', (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false)
    expect(subscriptionSchema.safeParse({ endpoint, keys }).success).toBe(false)
  })
})

describe('push body', () => {
  const note = { id: 1, recipient: 2, kind: 'comment', description: 'Hello' }

  it('keeps only paths of this site as the url', () => {
    for (const link of ['//evil.example/x', '/\\evil.example/x', 'https://evil.example/x', '']) {
      expect(JSON.parse(pushBody({ ...note, link }, 'en')).url).toBe('/')
    }
    expect(JSON.parse(pushBody({ ...note, link: '/spaces/a/posts/3' }, 'en')).url).toBe(
      '/spaces/a/posts/3',
    )
  })

  it('ends and stays under 4 KB for a huge link and a huge line', () => {
    const body = pushBody(
      { ...note, description: 'ب'.repeat(20_000), link: `/${'x'.repeat(20_000)}` },
      'ar',
    )
    expect(Buffer.byteLength(body)).toBeLessThan(4096)
    expect(JSON.parse(body).url).toBe('/')
  })

  it('carries nothing beyond the bell line, the kind title, a path and a tag', () => {
    expect(Object.keys(JSON.parse(pushBody({ ...note, link: '/a' }, 'en'))).sort()).toEqual([
      'body',
      'icon',
      'tag',
      'title',
      'url',
    ])
  })
})

describe('push-subscriptions collection', () => {
  it('refuses every request; the keys move only through the Local API', () => {
    const { access } = PushSubscriptions
    for (const op of ['read', 'create', 'update', 'delete'] as const) {
      expect(access?.[op]?.({ req: { user: { id: 1 } } } as never)).toBe(false)
    }
  })

  it('keeps the endpoint unique', () => {
    const endpoint = PushSubscriptions.fields.find((f) => 'name' in f && f.name === 'endpoint')
    expect(endpoint).toMatchObject({ unique: true, required: true })
  })
})
