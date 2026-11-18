import { describe, expect, it } from 'vitest'

import type { CronResult } from '@/lib/space-cron'
import { handleSpacesCron, refuseSpacesCronMethod } from '@/lib/space-cron-request'

const SECRET = 'a-long-test-secret-0123456789-0123456789'

const done = {
  digests: { considered: 3, sent: 2, failed: 0 },
  purge: 'skipped',
} satisfies CronResult

const host = (result: () => Promise<CronResult> = async () => done) => {
  let runs = 0
  const run = () => {
    runs++
    return result()
  }
  const call = (headers: Record<string, string> = {}, secret: string | null = SECRET) =>
    handleSpacesCron(
      new Request('https://example.test/api/cron/spaces', { method: 'POST', headers }),
      { secret: secret ?? undefined, run },
    )
  return { call, runs: () => runs, run }
}

describe('POST /api/cron/spaces', () => {
  it('refuses everyone while CRON_SECRET is not set', async () => {
    const cron = host()
    const res = await cron.call({ authorization: `Bearer ${SECRET}` }, null)
    expect(res.status).toBe(503)
    expect(cron.runs()).toBe(0)
  })

  it('refuses a missing, wrong or differently shaped secret', async () => {
    const cron = host()
    for (const headers of [
      {} as Record<string, string>,
      { authorization: 'Bearer wrong' },
      { authorization: SECRET },
      { authorization: `Basic ${SECRET}` },
      { authorization: `Bearer ${SECRET}x` },
      { authorization: 'Bearer ' },
    ]) {
      const res = await cron.call(headers)
      expect(res.status).toBe(401)
    }
    expect(cron.runs()).toBe(0)
  })

  it('takes no secret from the query string', async () => {
    const cron = host()
    const res = await handleSpacesCron(
      new Request(`https://example.test/api/cron/spaces?secret=${SECRET}&token=${SECRET}`, {
        method: 'POST',
      }),
      { secret: SECRET, run: cron.run },
    )
    expect(res.status).toBe(401)
    expect(cron.runs()).toBe(0)
  })

  it('runs the job for the right secret and answers with counts only', async () => {
    const cron = host()
    const res = await cron.call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({
      status: 'ok',
      digests: { considered: 3, sent: 2, failed: 0 },
      purge: 'skipped',
    })
    expect(JSON.stringify(body)).not.toContain(SECRET)
    expect(cron.runs()).toBe(1)
  })

  it('says busy, not ok, when another run holds the lock', async () => {
    const cron = host(async () => ({ busy: true }))
    const res = await cron.call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ status: 'busy' })
  })

  it('does not leak the failure and keeps no-store', async () => {
    const cron = host(async () => {
      throw new Error('select * from users where email = a@b.c')
    })
    const res = await cron.call({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(JSON.stringify(await res.json())).not.toContain('select')
  })

  it('refuses other methods', () => {
    const res = refuseSpacesCronMethod()
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
