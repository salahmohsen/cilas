// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { env } from '@/env'
import config from '@/payload.config'
import type { Newsletter, User } from '@/payload-types'

import { uniq, uniqEmail } from './fixtures'

let payload: Payload
let admin: User
let issue: Newsletter
let list: { id: number } | null = null
const ADMIN = uniqEmail('newsletter-admin-probe')

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
    admin = await payload.create({
      collection: 'users',
      data: { email: ADMIN, password: 'probe-password-1', roles: ['admin'] },
    })
    // A list of its own, with a made-up segment, so no real list is touched.
    list = await payload.create({
      collection: 'mailing-lists',
      data: {
        name: uniq('Probe list'),
        source: 'members',
        segment_id: 'seg_probe',
        members: { users: [] },
      },
      context: { mailingListSyncWrite: true },
    })
    issue = await payload.create({
      collection: 'newsletters',
      data: {
        title: 'Probe issue',
        slug: uniq('probe-issue'),
        issue_date: '2026-10-18',
        send_to: list.id,
      },
      draft: true,
    })
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await payload.delete({ collection: 'newsletters', id: issue.id }).catch(() => undefined)
    if (list)
      await payload.delete({ collection: 'mailing-lists', id: list.id }).catch(() => undefined)
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

  /** Resend, mocked: the broadcast, and the account's stored contacts. */
  const mockResend = (contacts: number) => {
    const realFetch = globalThis.fetch
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url === 'https://api.resend.com/broadcasts')
        return Promise.resolve(Response.json({ id: 'b_probe' }))
      // The probe list's segment, read by the sync before the send: empty.
      if (url.startsWith('https://api.resend.com/segments/seg_probe/contacts')) {
        return Promise.resolve(Response.json({ data: [], has_more: false }))
      }
      if (url.startsWith('https://api.resend.com/segments/metrics')) {
        return Promise.resolve(Response.json({ totals: { all_contacts: contacts } }))
      }
      return realFetch(input, init)
    })
  }

  it.runIf(Boolean(env.RESEND_API_KEY))('stops above the free plan’s contact limit', async () => {
    const fetch = mockResend(1200)
    const res = await call('send')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('1200 contacts')
    expect(fetch.mock.calls.some(([u]) => String(u) === 'https://api.resend.com/broadcasts')).toBe(
      false,
    )
    fetch.mockRestore()
  })

  it.runIf(Boolean(env.RESEND_API_KEY))('sends once, then publishes the issue', async () => {
    const fetch = mockResend(640)
    expect((await call('send')).status).toBe(200)
    const sent = fetch.mock.calls.find(([u]) => String(u).includes('/broadcasts'))!
    expect(JSON.parse(sent[1]!.body as string).html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
    const after = await payload.findByID({ collection: 'newsletters', id: issue.id, depth: 0 })
    expect(after).toMatchObject({ _status: 'published', broadcast_id: 'b_probe' })
    expect((await call('send')).status).toBe(409)
  })
})
