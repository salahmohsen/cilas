import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/(frontend)/api/notifications/stream/route'
import config from '@/payload.config'

import { runInRequest } from '../../../../../../testing/next-request.test-utils'
import { createTracker, uniqEmail } from '../../../../../../testing/payload.fixture'
import { signedInHeaders } from '../../../../../../testing/reader.test-utils'

let payload: Payload
let reader: HeadersInit
let account: number
const { track, cleanup } = createTracker()

const hub = () =>
  (
    globalThis as typeof globalThis & {
      __cilasNotificationHub?: { sinks: Map<number, Set<unknown>> }
    }
  ).__cilasNotificationHub

const listeners = async () =>
  (
    await payload.db.pool.query(
      `SELECT 1 FROM pg_stat_activity WHERE application_name = 'cilas-notifications' AND query LIKE 'LISTEN%'`,
    )
  ).rowCount

const stream = (signal?: AbortSignal) =>
  runInRequest(
    async () =>
      GET(new Request('http://localhost/api/notifications/stream', signal ? { signal } : {})),
    { headers: reader },
  ).then(({ result }) => result)

const decode = async (chunks: ReadableStreamDefaultReader<Uint8Array>) =>
  new TextDecoder().decode((await chunks.read()).value)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const password = crypto.randomUUID()
  const email = uniqEmail('notification-stream')
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password, roles: ['member'] },
      overrideAccess: true,
    }),
  )
  account = user.id
  reader = await signedInHeaders(payload, { email, password })

  const before = await listeners()
  const warm = await stream()
  await vi.waitFor(async () => expect(await listeners()).toBeGreaterThan(before!))
  await warm.body!.cancel()
})

afterAll(async () => {
  await payload.db.pool.query(`DELETE FROM notifications WHERE recipient_id = $1`, [account])
  await cleanup(payload)
  await payload.destroy()
})

describe('GET /api/notifications/stream', () => {
  it('refuses a request with no signed-in account', async () => {
    const res = await runInRequest(async () =>
      GET(new Request('http://localhost/api/notifications/stream')),
    ).then(({ result }) => result)
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Sign in first.')
    expect(hub()!.sinks.size).toBe(0)
  })

  it('streams only the signed-in account, with headers that stop buffering', async () => {
    const note = await payload.create({
      collection: 'notifications',
      data: { recipient: account, kind: 'comment', title: 'Stream probe' },
      overrideAccess: true,
    })
    const abort = new AbortController()
    const res = await stream(abort.signal)
    expect(hub()!.sinks.get(account)?.size).toBe(1)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-transform')
    expect(res.headers.get('x-accel-buffering')).toBe('no')

    const chunks = res.body!.getReader()
    expect(await decode(chunks)).toContain('retry: 3000')
    await payload.delete({ collection: 'notifications', id: note.id, overrideAccess: true })
    expect(await decode(chunks)).toBe(
      `event: notification\ndata: {"op":"deleted","id":${note.id}}\n\n`,
    )

    abort.abort()
    expect(hub()!.sinks.has(account)).toBe(false)
  })

  it('removes its listener when the browser cancels the stream', async () => {
    const res = await stream()
    expect(hub()!.sinks.get(account)?.size).toBe(1)
    await res.body!.cancel()
    expect(hub()!.sinks.has(account)).toBe(false)
  })
})
