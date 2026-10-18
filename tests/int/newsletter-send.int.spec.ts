// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { env } from '@/env'
import config from '@/payload.config'
import type { Newsletter, User } from '@/payload-types'

let payload: Payload
let admin: User
let issue: Newsletter
const ADMIN = 'newsletter-admin-probe@cilas.test'

/** Calls a newsletter endpoint the way the sidebar buttons do. */
const call = async (action: 'test' | 'send', user: User | null = admin) => {
  const endpoints = payload.collections.newsletters.config.endpoints as {
    path: string
    handler: (req: never) => Promise<Response>
  }[]
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { id: String(issue.id) }
  return endpoints.find((e) => e.path === `/:id/${action}`)!.handler(req as never)
}

describe('sending a newsletter issue', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    await payload.delete({ collection: 'users', where: { email: { equals: ADMIN } } })
    await payload.delete({ collection: 'newsletters', where: { slug: { equals: 'probe-issue' } } })
    admin = await payload.create({
      collection: 'users',
      data: { email: ADMIN, password: 'probe-password-1', roles: ['admin'] },
    })
    issue = await payload.create({
      collection: 'newsletters',
      data: { title: 'Probe issue', slug: 'probe-issue', issue_date: '2026-10-18' },
      draft: true,
    })
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await payload.delete({ collection: 'newsletters', id: issue.id }).catch(() => undefined)
    await payload.delete({ collection: 'users', id: admin.id }).catch(() => undefined)
    await payload.destroy()
  })

  it('sends a test only to the admin', async () => {
    const res = await call('test')
    expect(res.status).toBe(200)
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ADMIN, subject: '[Test] Probe issue' }),
    )
  })

  it('refuses people who are not admins', async () => {
    expect((await call('send', null)).status).toBe(403)
  })

  it.runIf(Boolean(env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID))(
    'sends once, then publishes the issue',
    async () => {
      const realFetch = globalThis.fetch
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) =>
          String(input) === 'https://api.resend.com/broadcasts'
            ? Promise.resolve(Response.json({ id: 'b_probe' }))
            : realFetch(input, init),
        )
      expect((await call('send')).status).toBe(200)
      const sent = fetch.mock.calls.find(([u]) => String(u).includes('/broadcasts'))!
      expect(JSON.parse(sent[1]!.body as string).html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
      const after = await payload.findByID({ collection: 'newsletters', id: issue.id, depth: 0 })
      expect(after).toMatchObject({ _status: 'published', broadcast_id: 'b_probe' })
      expect((await call('send')).status).toBe(409)
    },
  )
})
