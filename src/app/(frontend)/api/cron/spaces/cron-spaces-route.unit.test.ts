import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'a-long-test-secret-0123456789-0123456789'
const state = vi.hoisted(() => ({ secret: undefined as string | undefined }))
const run = vi.hoisted(() => vi.fn())

vi.mock('@/env', () => ({
  env: {
    get CRON_SECRET() {
      return state.secret
    },
  },
}))
vi.mock('@/lib/space-cron', () => ({ runSpacesCron: run }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { DELETE, GET, PATCH, POST, PUT } from '@/app/(frontend)/api/cron/spaces/route'

const call = (headers: Record<string, string> = {}) =>
  POST(new Request('https://example.test/api/cron/spaces', { method: 'POST', headers }))

beforeEach(() => {
  state.secret = SECRET
  run.mockReset()
  run.mockResolvedValue({
    digests: { considered: 3, sent: 2, failed: 0 },
    purge: 'skipped',
  })
})
afterEach(() => vi.restoreAllMocks())

describe('POST /api/cron/spaces', () => {
  it('refuses everyone while CRON_SECRET is not set', async () => {
    state.secret = undefined
    const res = await call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(503)
    expect(run).not.toHaveBeenCalled()
  })

  it('refuses a missing, wrong or differently shaped secret', async () => {
    for (const headers of [
      {} as Record<string, string>,
      { authorization: 'Bearer wrong' },
      { authorization: SECRET },
      { authorization: `Basic ${SECRET}` },
      { authorization: `Bearer ${SECRET}x` },
      { authorization: 'Bearer ' },
    ]) {
      const res = await call(headers)
      expect(res.status).toBe(401)
    }
    expect(run).not.toHaveBeenCalled()
  })

  it('takes no secret from the query string', async () => {
    const res = await POST(
      new Request(`https://example.test/api/cron/spaces?secret=${SECRET}&token=${SECRET}`, {
        method: 'POST',
      }),
    )
    expect(res.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('runs the job for the right secret and answers with counts only', async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({
      status: 'ok',
      digests: { considered: 3, sent: 2, failed: 0 },
      purge: 'skipped',
    })
    expect(JSON.stringify(body)).not.toContain(SECRET)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('says busy, not ok, when another run holds the lock', async () => {
    run.mockResolvedValue({ busy: true })
    const res = await call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ status: 'busy' })
  })

  it('does not leak the failure and keeps no-store', async () => {
    run.mockRejectedValue(new Error('select * from users where email = a@b.c'))
    const res = await call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(JSON.stringify(await res.json())).not.toContain('select')
  })

  it('refuses other methods', async () => {
    for (const handler of [GET, PUT, PATCH, DELETE]) {
      const res = handler()
      expect(res.status).toBe(405)
      expect(res.headers.get('allow')).toBe('POST')
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    expect(run).not.toHaveBeenCalled()
  })
})
